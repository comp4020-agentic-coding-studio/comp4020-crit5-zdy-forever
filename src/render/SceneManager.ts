import {
  AmbientLight,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  FogExp2,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  CAMERA_DISTANCE,
  CAMERA_HEIGHT,
  CAMERA_LOOK_HEIGHT,
  PLANET_RADIUS,
  PLAYER_HEIGHT,
  ROCKET_LAUNCH_SPEED,
} from "../game/Constants.ts";
import { BEACON_POSITIONS, NPCS, RADIO_TOWER_POSITION, ROCKET_POSITION, SHELTER_POSITION } from "../game/World.ts";

const MESH_UP = new Vector3(0, 1, 0);

// Builds the Three.js scene once and exposes small, focused update methods
// so the pure game layer (src/game) never has to import Three.js itself.
export class SceneManager {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly renderer: WebGLRenderer;
  private readonly playerMesh: Mesh;
  private readonly ghostMesh: Mesh;
  private readonly ghostLight: PointLight;
  private readonly rocketMesh: Mesh;
  private readonly rocketUp: Vector3;
  private rocketAltitude = 0;

  // How close the ghost is (0 = far/dormant, 1 = right on top of the
  // player) -- drives a very small camera jitter, skipped entirely under
  // prefers-reduced-motion.
  private dread = 0;
  private readonly reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Carried frame-to-frame so the camera eases toward its ideal position
  // instead of snapping to it every frame.
  private readonly cameraPosition = new Vector3();
  private readonly cameraLookAt = new Vector3();
  private cameraInitialized = false;

  // Scratch vectors reused every frame to avoid per-frame allocation.
  private readonly desiredCameraPosition = new Vector3();
  private readonly desiredLookAt = new Vector3();
  private readonly backward = new Vector3();
  private readonly rawCameraForward = new Vector3();
  private readonly upProjection = new Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new Color(0x030304);
    this.scene.fog = new FogExp2(0x030304, 0.018);

    this.camera = new PerspectiveCamera(55, 1, 0.1, 200);

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.add(new AmbientLight(0x1a1a26, 0.6));
    this.scene.add(new HemisphereLight(0x1c2436, 0x050506, 0.5));

    const planet = new Mesh(
      new IcosahedronGeometry(PLANET_RADIUS, 2),
      new MeshStandardMaterial({ color: 0x2a2b30, roughness: 1, flatShading: true }),
    );
    this.scene.add(planet);

    this.playerMesh = new Mesh(
      new ConeGeometry(0.4, 1.3, 6),
      new MeshStandardMaterial({ color: 0xcbb994, roughness: 0.8, flatShading: true }),
    );
    this.scene.add(this.playerMesh);

    // A pale, slightly translucent shroud with a cold light of its own --
    // the one thing on the planet that isn't lit warmly.
    this.ghostMesh = new Mesh(
      new IcosahedronGeometry(0.55, 1),
      new MeshStandardMaterial({
        color: 0x9fd8ff,
        emissive: 0x1c3a52,
        roughness: 0.35,
        transparent: true,
        opacity: 0.6,
        flatShading: true,
      }),
    );
    this.ghostMesh.scale.set(1, 1.6, 1);
    this.scene.add(this.ghostMesh);

    this.ghostLight = new PointLight(0x6fb7ff, 5, 10, 2);
    this.scene.add(this.ghostLight);

    this.buildNpcs();
    const rocket = this.buildLandmarks();
    this.rocketMesh = rocket.mesh;
    this.rocketUp = rocket.up;
  }

  // NPCs never move, so their meshes/lights are built once here rather than
  // synced every frame like the player. A warm light reads as "someone
  // here" against the cold, empty rest of the planet.
  private buildNpcs(): void {
    const material = new MeshStandardMaterial({ color: 0xcf9a5c, roughness: 0.7, flatShading: true });
    const up = new Vector3();

    for (const npc of NPCS) {
      up.copy(npc.position).normalize();

      const mesh = new Mesh(new CapsuleGeometry(0.35, 0.9, 2, 6), material);
      mesh.position.copy(npc.position).addScaledVector(up, 0.8);
      mesh.quaternion.setFromUnitVectors(MESH_UP, up);
      this.scene.add(mesh);

      const light = new PointLight(0xffb066, 6, 9, 2);
      light.position.copy(npc.position).addScaledVector(up, 1.6);
      this.scene.add(light);
    }
  }

  // The static environmental landmarks that lead the player from the NPCs
  // toward the rocket: a radio tower, a damaged shelter, a chain of red
  // beacons, and the rocket itself. Returns the rocket's mesh/up so the
  // constructor can keep them for the launch animation.
  private buildLandmarks(): { mesh: Mesh; up: Vector3 } {
    const up = new Vector3();
    const darkMetal = new MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.9, flatShading: true });

    up.copy(RADIO_TOWER_POSITION).normalize();
    const tower = new Mesh(new CylinderGeometry(0.15, 0.3, 7, 5), darkMetal);
    tower.position.copy(RADIO_TOWER_POSITION).addScaledVector(up, 3.5);
    tower.quaternion.setFromUnitVectors(MESH_UP, up);
    this.scene.add(tower);

    up.copy(SHELTER_POSITION).normalize();
    const shelter = new Mesh(
      new SphereGeometry(1.6, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new MeshStandardMaterial({ color: 0x24252b, roughness: 1, flatShading: true }),
    );
    shelter.position.copy(SHELTER_POSITION);
    shelter.quaternion.setFromUnitVectors(MESH_UP, up);
    this.scene.add(shelter);

    const beaconMaterial = new MeshStandardMaterial({
      color: 0x4a1414,
      emissive: 0xaa2222,
      emissiveIntensity: 1.2,
      roughness: 0.6,
      flatShading: true,
    });
    for (const beaconPosition of BEACON_POSITIONS) {
      up.copy(beaconPosition).normalize();

      const beacon = new Mesh(new ConeGeometry(0.4, 1.4, 5), beaconMaterial);
      beacon.position.copy(beaconPosition).addScaledVector(up, 0.7);
      beacon.quaternion.setFromUnitVectors(MESH_UP, up);
      this.scene.add(beacon);

      const light = new PointLight(0xff3b30, 5, 8, 2);
      light.position.copy(beaconPosition).addScaledVector(up, 1.6);
      this.scene.add(light);
    }

    const rocketUp = ROCKET_POSITION.clone().normalize();
    const rocketMesh = new Mesh(
      new ConeGeometry(0.9, 3.2, 8),
      new MeshStandardMaterial({ color: 0xd7dbe2, roughness: 0.5, flatShading: true }),
    );
    rocketMesh.quaternion.setFromUnitVectors(MESH_UP, rocketUp);
    this.scene.add(rocketMesh);

    const rocketLight = new PointLight(0xffffff, 5, 10, 2);
    rocketLight.position.copy(ROCKET_POSITION).addScaledVector(rocketUp, 2.5);
    this.scene.add(rocketLight);

    return { mesh: rocketMesh, up: rocketUp };
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  syncPlayer(position: Vector3, up: Vector3): void {
    this.playerMesh.position.copy(position).addScaledVector(up, PLAYER_HEIGHT * 0.5);
    this.playerMesh.quaternion.setFromUnitVectors(MESH_UP, up);
  }

  syncGhost(position: Vector3, up: Vector3): void {
    this.ghostMesh.position.copy(position).addScaledVector(up, 0.9);
    this.ghostMesh.quaternion.setFromUnitVectors(MESH_UP, up);
    this.ghostLight.position.copy(position).addScaledVector(up, 1.2);
  }

  // Forces the next updateCamera call to snap to its target instead of
  // easing toward it -- used after a restart, when the player teleports
  // back to spawn and a smooth follow would sweep across the whole planet.
  resetCamera(): void {
    this.cameraInitialized = false;
  }

  // Called every frame regardless of phase, so the rocket sits at rest on
  // the pad until `launching` (the win condition landing) starts it rising.
  updateRocket(launching: boolean, deltaSeconds: number): void {
    if (launching) this.rocketAltitude += deltaSeconds * ROCKET_LAUNCH_SPEED;
    this.rocketMesh.position.copy(ROCKET_POSITION).addScaledVector(this.rocketUp, 1.6 + this.rocketAltitude);
  }

  resetRocket(): void {
    this.rocketAltitude = 0;
  }

  // 0 (calm) to 1 (right on top of the player). Read live each frame rather
  // than cached, so a system-level reduced-motion toggle takes effect
  // immediately without needing a restart.
  setDread(dread: number): void {
    this.dread = dread;
  }

  updateCamera(playerPosition: Vector3, up: Vector3, forward: Vector3, deltaSeconds: number): void {
    this.backward.copy(forward).multiplyScalar(-1);
    this.desiredCameraPosition
      .copy(playerPosition)
      .addScaledVector(up, CAMERA_HEIGHT)
      .addScaledVector(this.backward, CAMERA_DISTANCE);
    this.desiredLookAt.copy(playerPosition).addScaledVector(up, CAMERA_LOOK_HEIGHT);

    if (!this.cameraInitialized) {
      this.cameraPosition.copy(this.desiredCameraPosition);
      this.cameraLookAt.copy(this.desiredLookAt);
      this.cameraInitialized = true;
    } else {
      const followRate = 1 - Math.pow(0.001, deltaSeconds);
      this.cameraPosition.lerp(this.desiredCameraPosition, followRate);
      this.cameraLookAt.lerp(this.desiredLookAt, followRate);
    }

    this.camera.position.copy(this.cameraPosition);
    if (this.dread > 0 && !this.reducedMotionQuery.matches) {
      const magnitude = this.dread * 0.05;
      this.camera.position.x += (Math.random() * 2 - 1) * magnitude;
      this.camera.position.y += (Math.random() * 2 - 1) * magnitude;
      this.camera.position.z += (Math.random() * 2 - 1) * magnitude;
    }
    this.camera.up.copy(up);
    this.camera.lookAt(this.cameraLookAt);
  }

  // The camera's forward/right, flattened onto the tangent plane at `up` --
  // this is what "movement relative to the camera" means on a sphere. Input
  // is mapped against these, not the raw camera direction, so walking stays
  // on the surface even while the camera looks slightly down at the planet.
  getGroundBasis(up: Vector3, outForward: Vector3, outRight: Vector3): void {
    this.camera.getWorldDirection(this.rawCameraForward);
    this.upProjection.copy(up).multiplyScalar(this.rawCameraForward.dot(up));
    outForward.copy(this.rawCameraForward).sub(this.upProjection);
    if (outForward.lengthSq() < 1e-6) {
      // Looking straight down/up (rare, e.g. right after a reset): fall back
      // to the last known backward direction rather than producing NaNs.
      outForward.copy(this.backward).multiplyScalar(-1);
    }
    outForward.normalize();
    outRight.crossVectors(outForward, up).normalize();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
