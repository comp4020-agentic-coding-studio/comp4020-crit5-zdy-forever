import {
  AmbientLight,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  FogExp2,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  CAMERA_DISTANCE,
  CAMERA_HEIGHT,
  CAMERA_LOOK_HEIGHT,
  PLANET_RADIUS,
  PLAYER_HEIGHT,
} from "../game/Constants.ts";
import { NPCS } from "../game/World.ts";

const MESH_UP = new Vector3(0, 1, 0);

// Builds the Three.js scene once and exposes small, focused update methods
// so the pure game layer (src/game) never has to import Three.js itself.
export class SceneManager {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly renderer: WebGLRenderer;
  private readonly playerMesh: Mesh;

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

    this.buildNpcs();
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

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  syncPlayer(position: Vector3, up: Vector3): void {
    this.playerMesh.position.copy(position).addScaledVector(up, PLAYER_HEIGHT * 0.5);
    this.playerMesh.quaternion.setFromUnitVectors(MESH_UP, up);
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
