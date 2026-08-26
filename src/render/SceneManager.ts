import {
  AmbientLight,
  BoxGeometry,
  CapsuleGeometry,
  Color,
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
  CAMERA_EYE_HEIGHT,
  CAMERA_FOV_DEGREES,
  CAMERA_FOV_MAX_DEGREES,
  CAMERA_FOV_REFERENCE_ASPECT,
  CORRIDOR_HEIGHT,
  MAZE_CELL_SIZE,
  MAZE_CORRIDOR_HALF_WIDTH,
} from "../game/Constants.ts";
import {
  DAMAGED_FIXTURE_INDICES,
  EXIT_DOOR_AXIS,
  EXIT_POSITION,
  LIGHT_FIXTURE_POSITIONS,
  MAZE_COLS,
  MAZE_ROWS,
  cellCenter,
  isHorizontalOpen,
  isVerticalOpen,
  openingsOf,
} from "../game/Maze.ts";

const UP = new Vector3(0, 1, 0);
const FALLBACK_FORWARD = new Vector3(0, 0, -1);
const AMBIENT_BASE_INTENSITY = 1.1;
const HEMISPHERE_BASE_INTENSITY = 0.85;
const FIXTURE_LIGHT_BASE_INTENSITY = 4.5;
const GHOST_CAPSULE_RADIUS = 0.3;
const GHOST_CAPSULE_LENGTH = 2.2;
const GHOST_MESH_HALF_HEIGHT = GHOST_CAPSULE_LENGTH / 2 + GHOST_CAPSULE_RADIUS;
const HALF_PITCH = MAZE_CELL_SIZE / 2;
const WALL_THICKNESS = 0.2;

// Builds the Three.js scene once and exposes small, focused update methods
// so the pure game layer (src/game) never has to import Three.js itself.
export class SceneManager {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly renderer: WebGLRenderer;
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

  // Scratch vectors reused every frame to avoid per-frame allocation.
  private readonly lookAtTarget = new Vector3();
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

    this.buildMaze();
    this.buildFixtures();
    this.buildExit();

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

  // One floor+ceiling pair per cell (its footprint extended flush to the
  // cell boundary on every open side, stopping at MAZE_CORRIDOR_HALF_WIDTH
  // on every closed one -- open neighbours' footprints meet exactly at the
  // shared boundary, no gap and no overlap), plus one wall per closed edge
  // (built once from the edge/boundary loops below, not once per adjoining
  // cell, so a closed internal edge never gets a doubled-up wall mesh).
  private buildMaze(): void {
    const floorMaterial = new MeshStandardMaterial({ color: 0x161619, roughness: 1, flatShading: true });
    const ceilingMaterial = new MeshStandardMaterial({ color: 0x101013, roughness: 1, flatShading: true });
    const wallMaterial = new MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.95, flatShading: true });

    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        this.buildMazeRoom(row, col, floorMaterial, ceilingMaterial);
      }
    }

    for (let row = 0; row < MAZE_ROWS; row++) {
      const leftCenter = cellCenter(row, 0);
      this.buildWall(leftCenter.x - MAZE_CORRIDOR_HALF_WIDTH, leftCenter.z, false, wallMaterial);
      const rightCenter = cellCenter(row, MAZE_COLS - 1);
      this.buildWall(rightCenter.x + MAZE_CORRIDOR_HALF_WIDTH, rightCenter.z, false, wallMaterial);

      for (let col = 0; col < MAZE_COLS - 1; col++) {
        if (!isHorizontalOpen(row, col)) {
          const a = cellCenter(row, col);
          this.buildWall(a.x + HALF_PITCH, a.z, false, wallMaterial);
        }
      }
    }

    for (let col = 0; col < MAZE_COLS; col++) {
      const topCenter = cellCenter(0, col);
      this.buildWall(topCenter.x, topCenter.z - MAZE_CORRIDOR_HALF_WIDTH, true, wallMaterial);
      const bottomCenter = cellCenter(MAZE_ROWS - 1, col);
      this.buildWall(bottomCenter.x, bottomCenter.z + MAZE_CORRIDOR_HALF_WIDTH, true, wallMaterial);

      for (let row = 0; row < MAZE_ROWS - 1; row++) {
        if (!isVerticalOpen(row, col)) {
          const a = cellCenter(row, col);
          this.buildWall(a.x, a.z + HALF_PITCH, true, wallMaterial);
        }
      }
    }
  }

  private buildMazeRoom(row: number, col: number, floorMaterial: MeshStandardMaterial, ceilingMaterial: MeshStandardMaterial): void {
    const center = cellCenter(row, col);
    const { leftOpen, rightOpen, upOpen, downOpen } = openingsOf(row, col);

    const minX = center.x - (leftOpen ? HALF_PITCH : MAZE_CORRIDOR_HALF_WIDTH);
    const maxX = center.x + (rightOpen ? HALF_PITCH : MAZE_CORRIDOR_HALF_WIDTH);
    const minZ = center.z - (upOpen ? HALF_PITCH : MAZE_CORRIDOR_HALF_WIDTH);
    const maxZ = center.z + (downOpen ? HALF_PITCH : MAZE_CORRIDOR_HALF_WIDTH);
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;

    const floor = new Mesh(new BoxGeometry(width, 0.2, depth), floorMaterial);
    floor.position.set(midX, -0.1, midZ);
    this.scene.add(floor);

    const ceiling = new Mesh(new BoxGeometry(width, 0.2, depth), ceilingMaterial);
    ceiling.position.set(midX, CORRIDOR_HEIGHT + 0.1, midZ);
    this.scene.add(ceiling);
  }

  // spansX: true builds a wall long along X/thin along Z (blocks north-south
  // movement -- a vertical-edge or grid top/bottom closure); false builds a
  // wall long along Z/thin along X (blocks east-west movement -- a
  // horizontal-edge or grid left/right closure).
  private buildWall(centerX: number, centerZ: number, spansX: boolean, material: MeshStandardMaterial): void {
    const span = MAZE_CORRIDOR_HALF_WIDTH * 2;
    const width = spansX ? span : WALL_THICKNESS;
    const depth = spansX ? WALL_THICKNESS : span;
    const wall = new Mesh(new BoxGeometry(width, CORRIDOR_HEIGHT, depth), material);
    wall.position.set(centerX, CORRIDOR_HEIGHT / 2, centerZ);
    this.scene.add(wall);
  }

  // Ceiling fixture meshes + matching PointLights, each independently
  // dimmable so updateLights can drive the on/warning/dark cycle. Kept in
  // parallel arrays rather than one object list to avoid per-frame
  // allocation when scaling their intensity every tick.
  private buildFixtures(): void {
    for (let i = 0; i < LIGHT_FIXTURE_POSITIONS.length; i++) {
      const position = LIGHT_FIXTURE_POSITIONS[i];
      const material = new MeshStandardMaterial({
        color: 0x3a3226,
        emissive: 0xffe9c2,
        emissiveIntensity: 1,
        roughness: 0.6,
        flatShading: true,
      });
      const mesh = new Mesh(new BoxGeometry(0.6, 0.12, 0.6), material);
      mesh.position.set(position.x, CORRIDOR_HEIGHT - 0.1, position.z);
      this.scene.add(mesh);

      const light = new PointLight(0xffdca8, FIXTURE_LIGHT_BASE_INTENSITY, 7, 2);
      light.position.set(position.x, CORRIDOR_HEIGHT - 0.3, position.z);
      this.scene.add(light);

      this.fixtureMaterials.push(material);
      this.fixtureLights.push(light);
    }
  }

  // The exit door and its glow -- always on, independent of the light cycle,
  // so it stays a fixed point of orientation even through a blackout.
  // Oriented across EXIT_DOOR_AXIS (derived from the exit cell's one real
  // opening) rather than assuming the maze's exit sits at a fixed +Z wall.
  private buildExit(): void {
    const alongX = Math.abs(EXIT_DOOR_AXIS.x) > Math.abs(EXIT_DOOR_AXIS.z);
    const doorPanelSpan = MAZE_CORRIDOR_HALF_WIDTH * 1.6;
    const doorWidth = alongX ? 0.3 : doorPanelSpan;
    const doorDepth = alongX ? doorPanelSpan : 0.3;
    const door = new Mesh(
      new BoxGeometry(doorWidth, CORRIDOR_HEIGHT - 0.4, doorDepth),
      new MeshStandardMaterial({ color: 0x14201c, roughness: 0.8, flatShading: true }),
    );
    door.position.set(
      EXIT_POSITION.x + EXIT_DOOR_AXIS.x * (MAZE_CORRIDOR_HALF_WIDTH + 0.5),
      (CORRIDOR_HEIGHT - 0.4) / 2,
      EXIT_POSITION.z + EXIT_DOOR_AXIS.z * (MAZE_CORRIDOR_HALF_WIDTH + 0.5),
    );
    this.scene.add(door);

    const exitLight = new PointLight(0x8fe0c8, 6, 14, 2);
    exitLight.position.set(
      EXIT_POSITION.x + EXIT_DOOR_AXIS.x * MAZE_CORRIDOR_HALF_WIDTH,
      CORRIDOR_HEIGHT * 0.6,
      EXIT_POSITION.z + EXIT_DOOR_AXIS.z * MAZE_CORRIDOR_HALF_WIDTH,
    );
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

  syncGhost(position: Vector3): void {
    this.ghostMesh.position.copy(position).setY(GHOST_MESH_HALF_HEIGHT);
  }

  // 0 (calm) to 1 (right on top of the player). Read live each frame rather
  // than cached, so a system-level reduced-motion toggle takes effect
  // immediately without needing a restart.
  setDread(dread: number): void {
    this.dread = dread;
  }

  // intensity: LightController's 0 (dark) .. 1 (on) value. Ambient/hemisphere
  // keep a small floor (never truly zero) so the maze's silhouette stays
  // faintly readable even during a blackout; the fixtures themselves swing
  // fully from off to on. A handful of fixtures flicker a little even at
  // full intensity -- a cosmetic, always-on detail unrelated to game state.
  updateLights(intensity: number, deltaSeconds: number): void {
    this.flickerClock += deltaSeconds;
    const ambientFraction = 0.06 + 0.94 * intensity;
    this.ambientLight.intensity = AMBIENT_BASE_INTENSITY * ambientFraction;
    this.hemisphereLight.intensity = HEMISPHERE_BASE_INTENSITY * ambientFraction;

    for (let i = 0; i < this.fixtureLights.length; i++) {
      const damagedFlicker = DAMAGED_FIXTURE_INDICES.includes(i) ? 0.55 + 0.45 * Math.sin(this.flickerClock * 14) : 1;
      const fixtureIntensity = intensity * damagedFlicker;
      this.fixtureLights[i].intensity = FIXTURE_LIGHT_BASE_INTENSITY * fixtureIntensity;
      this.fixtureMaterials[i].emissiveIntensity = fixtureIntensity;
    }
  }

  // First-person: the camera sits exactly at the player's eye position and
  // looks exactly along `forward` -- no lerp/lag, since the player's
  // collision-resolved position is already clean each frame, and lagging
  // the view behind input is exactly the disconnect first-person cameras
  // need to avoid. `forward` itself already eases toward the movement
  // direction at a capped turn rate (Player.move), which is what makes
  // backing away swing the view around to reveal what's behind you.
  updateCamera(playerPosition: Vector3, forward: Vector3): void {
    this.camera.position.copy(playerPosition).setY(CAMERA_EYE_HEIGHT);
    if (this.dread > 0 && !this.reducedMotionQuery.matches) {
      const magnitude = this.dread * 0.05;
      this.camera.position.x += (Math.random() * 2 - 1) * magnitude;
      this.camera.position.y += (Math.random() * 2 - 1) * magnitude;
      this.camera.position.z += (Math.random() * 2 - 1) * magnitude;
    }
    this.lookAtTarget.copy(this.camera.position).add(forward);
    this.camera.up.copy(UP);
    this.camera.lookAt(this.lookAtTarget);
  }

  // The camera's forward/right, flattened onto the floor plane -- this is
  // what "movement relative to the camera" means on flat ground. Input is
  // mapped against these, not the raw camera direction, so looking slightly
  // down/up doesn't change how fast the player moves along the floor.
  getGroundBasis(outForward: Vector3, outRight: Vector3): void {
    this.camera.getWorldDirection(this.rawCameraForward);
    outForward.set(this.rawCameraForward.x, 0, this.rawCameraForward.z);
    if (outForward.lengthSq() < 1e-6) {
      // Looking straight down/up -- can't happen given forward is always
      // kept horizontal (Player.move), but guards against NaNs if that ever
      // changes.
      outForward.copy(FALLBACK_FORWARD);
    }
    outForward.normalize();
    outRight.crossVectors(outForward, UP).normalize();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
