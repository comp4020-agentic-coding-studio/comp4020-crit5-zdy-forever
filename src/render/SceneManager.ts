import {
  AmbientLight,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  FogExp2,
  HemisphereLight,
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
  CAMERA_FOV_DEGREES,
  CAMERA_FOV_MAX_DEGREES,
  CAMERA_FOV_REFERENCE_ASPECT,
  CAMERA_HEIGHT,
  CAMERA_LOOK_HEIGHT,
  CORRIDOR_HEIGHT,
  CORRIDOR_LENGTH,
  PLAYER_HEIGHT,
} from "../game/Constants.ts";
import {
  CHAMBER_CENTER_Z,
  CHAMBER_HALF_LENGTH,
  CHAMBER_HALF_WIDTH,
  DAMAGED_FIXTURE_INDEX,
  EXIT_POSITION,
  LIGHT_FIXTURE_POSITIONS,
  corridorHalfWidthAt,
} from "../game/Corridor.ts";

const UP = new Vector3(0, 1, 0);
const AMBIENT_BASE_INTENSITY = 1.1;
const HEMISPHERE_BASE_INTENSITY = 0.85;
const FIXTURE_LIGHT_BASE_INTENSITY = 4.5;
const PLAYER_MESH_HEIGHT = PLAYER_HEIGHT * 1.5;
const GHOST_CAPSULE_RADIUS = 0.3;
const GHOST_CAPSULE_LENGTH = 2.2;
const GHOST_MESH_HALF_HEIGHT = GHOST_CAPSULE_LENGTH / 2 + GHOST_CAPSULE_RADIUS;

// Builds the Three.js scene once and exposes small, focused update methods
// so the pure game layer (src/game) never has to import Three.js itself.
export class SceneManager {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly renderer: WebGLRenderer;
  private readonly playerMesh: Mesh;
  private readonly ghostMesh: Mesh;
  private readonly ambientLight: AmbientLight;
  private readonly hemisphereLight: HemisphereLight;
  private readonly fixtureLights: PointLight[] = [];
  private readonly fixtureMaterials: MeshStandardMaterial[] = [];
  private flickerClock = 0;

  // How close the ghost is (0 = far, 1 = right on top of the player) --
  // drives a very small camera jitter, skipped entirely under
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

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new Color(0x040406);
    this.scene.fog = new FogExp2(0x040406, 0.035);

    this.camera = new PerspectiveCamera(CAMERA_FOV_DEGREES, 1, 0.1, 200);

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.ambientLight = new AmbientLight(0x2a2a3a, AMBIENT_BASE_INTENSITY);
    this.scene.add(this.ambientLight);
    this.hemisphereLight = new HemisphereLight(0x33415c, 0x0a0a10, HEMISPHERE_BASE_INTENSITY);
    this.scene.add(this.hemisphereLight);

    this.buildCorridor();
    this.buildFixtures();
    this.buildExit();

    this.playerMesh = new Mesh(
      new ConeGeometry(0.4, PLAYER_MESH_HEIGHT, 6),
      new MeshStandardMaterial({ color: 0xcbb994, roughness: 0.8, flatShading: true }),
    );
    this.scene.add(this.playerMesh);

    // Tall, narrow, desaturated, and deliberately not emissive -- it has no
    // light of its own, so it only reads clearly once the corridor's own
    // lights come back on.
    this.ghostMesh = new Mesh(
      new CapsuleGeometry(GHOST_CAPSULE_RADIUS, GHOST_CAPSULE_LENGTH, 4, 8),
      new MeshStandardMaterial({ color: 0xaab4b8, roughness: 0.95, flatShading: true }),
    );
    const head = new Mesh(
      new SphereGeometry(0.22, 6, 5),
      new MeshStandardMaterial({ color: 0x9aa4a8, roughness: 1, flatShading: true }),
    );
    head.position.y = GHOST_CAPSULE_LENGTH / 2 + 0.18;
    this.ghostMesh.add(head);
    this.scene.add(this.ghostMesh);
  }

  // Segmented into three runs (before/through/after the wider chamber) so
  // the chamber actually reads as wider rather than being a uniform tube.
  private buildCorridor(): void {
    const floorMaterial = new MeshStandardMaterial({ color: 0x161619, roughness: 1, flatShading: true });
    const ceilingMaterial = new MeshStandardMaterial({ color: 0x101013, roughness: 1, flatShading: true });
    const wallMaterial = new MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.95, flatShading: true });

    const chamberStart = CHAMBER_CENTER_Z - CHAMBER_HALF_LENGTH;
    const chamberEnd = CHAMBER_CENTER_Z + CHAMBER_HALF_LENGTH;
    const segments: Array<[number, number]> = [
      [-1, chamberStart],
      [chamberStart, chamberEnd],
      [chamberEnd, CORRIDOR_LENGTH + 5],
    ];

    for (const [zStart, zEnd] of segments) {
      const halfWidth = corridorHalfWidthAt((zStart + zEnd) / 2);
      this.buildCorridorSegment(zStart, zEnd, halfWidth, floorMaterial, ceilingMaterial, wallMaterial);
    }
  }

  private buildCorridorSegment(
    zStart: number,
    zEnd: number,
    halfWidth: number,
    floorMaterial: MeshStandardMaterial,
    ceilingMaterial: MeshStandardMaterial,
    wallMaterial: MeshStandardMaterial,
  ): void {
    const length = zEnd - zStart;
    const centerZ = (zStart + zEnd) / 2;

    const floor = new Mesh(new BoxGeometry(halfWidth * 2, 0.2, length), floorMaterial);
    floor.position.set(0, -0.1, centerZ);
    this.scene.add(floor);

    const ceiling = new Mesh(new BoxGeometry(halfWidth * 2, 0.2, length), ceilingMaterial);
    ceiling.position.set(0, CORRIDOR_HEIGHT + 0.1, centerZ);
    this.scene.add(ceiling);

    const leftWall = new Mesh(new BoxGeometry(0.2, CORRIDOR_HEIGHT, length), wallMaterial);
    leftWall.position.set(-halfWidth, CORRIDOR_HEIGHT / 2, centerZ);
    this.scene.add(leftWall);

    const rightWall = new Mesh(new BoxGeometry(0.2, CORRIDOR_HEIGHT, length), wallMaterial);
    rightWall.position.set(halfWidth, CORRIDOR_HEIGHT / 2, centerZ);
    this.scene.add(rightWall);
  }

  // Ceiling fixture meshes + matching PointLights, each independently
  // dimmable so updateLights can drive the on/warning/dark cycle. Kept in
  // parallel arrays rather than one object list to avoid per-frame
  // allocation when scaling their intensity every tick.
  private buildFixtures(): void {
    for (const position of LIGHT_FIXTURE_POSITIONS) {
      const material = new MeshStandardMaterial({
        color: 0x3a3226,
        emissive: 0xffe9c2,
        emissiveIntensity: 1,
        roughness: 0.6,
        flatShading: true,
      });
      const mesh = new Mesh(new BoxGeometry(0.6, 0.12, 0.6), material);
      mesh.position.set(0, CORRIDOR_HEIGHT - 0.1, position.z);
      this.scene.add(mesh);

      const light = new PointLight(0xffdca8, FIXTURE_LIGHT_BASE_INTENSITY, 7, 2);
      light.position.set(0, CORRIDOR_HEIGHT - 0.3, position.z);
      this.scene.add(light);

      this.fixtureMaterials.push(material);
      this.fixtureLights.push(light);
    }
  }

  // The exit door and its glow -- always on, independent of the light cycle,
  // so it stays a fixed point of orientation even through a blackout.
  private buildExit(): void {
    const door = new Mesh(
      new BoxGeometry(CHAMBER_HALF_WIDTH, CORRIDOR_HEIGHT - 0.4, 0.3),
      new MeshStandardMaterial({ color: 0x14201c, roughness: 0.8, flatShading: true }),
    );
    door.position.set(0, (CORRIDOR_HEIGHT - 0.4) / 2, EXIT_POSITION.z + 1.5);
    this.scene.add(door);

    const exitLight = new PointLight(0x8fe0c8, 6, 14, 2);
    exitLight.position.set(0, CORRIDOR_HEIGHT * 0.6, EXIT_POSITION.z + 1);
    this.scene.add(exitLight);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(height, 1);
    this.camera.aspect = aspect;
    this.camera.fov = this.computeFov(aspect);
    this.camera.updateProjectionMatrix();
  }

  private computeFov(aspect: number): number {
    if (aspect >= CAMERA_FOV_REFERENCE_ASPECT) return CAMERA_FOV_DEGREES;

    const baseFovRad = (CAMERA_FOV_DEGREES * Math.PI) / 180;
    const targetHorizontalFovRad = 2 * Math.atan(Math.tan(baseFovRad / 2) * CAMERA_FOV_REFERENCE_ASPECT);
    const verticalFovRad = 2 * Math.atan(Math.tan(targetHorizontalFovRad / 2) / aspect);
    return Math.min((verticalFovRad * 180) / Math.PI, CAMERA_FOV_MAX_DEGREES);
  }

  syncPlayer(position: Vector3): void {
    this.playerMesh.position.copy(position).setY(PLAYER_MESH_HEIGHT / 2);
  }

  syncGhost(position: Vector3): void {
    this.ghostMesh.position.copy(position).setY(GHOST_MESH_HALF_HEIGHT);
  }

  // Forces the next updateCamera call to snap to its target instead of
  // easing toward it -- used after a restart, when the player teleports back
  // to spawn and a smooth follow would otherwise sweep across the corridor.
  resetCamera(): void {
    this.cameraInitialized = false;
  }

  // 0 (calm) to 1 (right on top of the player). Read live each frame rather
  // than cached, so a system-level reduced-motion toggle takes effect
  // immediately without needing a restart.
  setDread(dread: number): void {
    this.dread = dread;
  }

  // intensity: LightController's 0 (dark) .. 1 (on) value. Ambient/hemisphere
  // keep a small floor (never truly zero) so the corridor silhouette stays
  // faintly readable even during a blackout; the fixtures themselves swing
  // fully from off to on. One fixture flickers a little even at full
  // intensity -- a cosmetic, always-on detail unrelated to game state.
  updateLights(intensity: number, deltaSeconds: number): void {
    this.flickerClock += deltaSeconds;
    const ambientFraction = 0.06 + 0.94 * intensity;
    this.ambientLight.intensity = AMBIENT_BASE_INTENSITY * ambientFraction;
    this.hemisphereLight.intensity = HEMISPHERE_BASE_INTENSITY * ambientFraction;

    for (let i = 0; i < this.fixtureLights.length; i++) {
      const damagedFlicker = i === DAMAGED_FIXTURE_INDEX ? 0.55 + 0.45 * Math.sin(this.flickerClock * 14) : 1;
      const fixtureIntensity = intensity * damagedFlicker;
      this.fixtureLights[i].intensity = FIXTURE_LIGHT_BASE_INTENSITY * fixtureIntensity;
      this.fixtureMaterials[i].emissiveIntensity = fixtureIntensity;
    }
  }

  updateCamera(playerPosition: Vector3, forward: Vector3, deltaSeconds: number): void {
    this.backward.copy(forward).multiplyScalar(-1);
    this.desiredCameraPosition
      .copy(playerPosition)
      .addScaledVector(UP, CAMERA_HEIGHT)
      .addScaledVector(this.backward, CAMERA_DISTANCE);
    this.desiredLookAt.copy(playerPosition).addScaledVector(UP, CAMERA_LOOK_HEIGHT);

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
    this.camera.up.copy(UP);
    this.camera.lookAt(this.cameraLookAt);
  }

  // The camera's forward/right, flattened onto the floor plane -- this is
  // what "movement relative to the camera" means on flat ground. Input is
  // mapped against these, not the raw camera direction, so looking slightly
  // down/up doesn't change how fast the player moves along the floor.
  getGroundBasis(outForward: Vector3, outRight: Vector3): void {
    this.camera.getWorldDirection(this.rawCameraForward);
    outForward.set(this.rawCameraForward.x, 0, this.rawCameraForward.z);
    if (outForward.lengthSq() < 1e-6) {
      // Looking straight down/up (rare, e.g. right after a reset): fall back
      // to the last known backward direction rather than producing NaNs.
      outForward.copy(this.backward).multiplyScalar(-1);
    }
    outForward.normalize();
    outRight.crossVectors(outForward, UP).normalize();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
