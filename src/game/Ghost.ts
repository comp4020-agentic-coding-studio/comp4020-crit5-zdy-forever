import { Vector3 } from "three";
import { GHOST_DETECT_RADIUS, GHOST_LOSE_RADIUS, GHOST_SPEED, GHOST_WANDER_SPEED_FACTOR, PLANET_RADIUS } from "./Constants.ts";
import { moveOnSphere } from "./sphereMotion.ts";
import { GHOST_SPAWN_POINT } from "./World.ts";

export type GhostMode = "dormant" | "wander" | "chase";

const WANDER_MIN_DURATION_SECONDS = 2.5;
const WANDER_MAX_DURATION_SECONDS = 5;

// Scratch, reused every frame/wander pick to avoid per-frame allocation.
const toPlayer = new Vector3();
const up = new Vector3();
const projection = new Vector3();
const randomTangent = new Vector3();

// Its own small AI, independent of GameState: dormant until the player has
// found the first NPC (nothing to escape from in the opening seconds), then
// alternates between an aimless wander and, once close enough to notice the
// player, a direct chase. GHOST_LOSE_RADIUS is deliberately larger than
// GHOST_DETECT_RADIUS so hovering right at the boundary doesn't flicker
// between the two every frame.
export class Ghost {
  readonly position: Vector3;
  mode: GhostMode = "dormant";

  private readonly wanderDirection = new Vector3();
  private wanderTimeRemaining = 0;

  constructor() {
    this.position = GHOST_SPAWN_POINT.clone();
  }

  get up(): Vector3 {
    return this.position.clone().normalize();
  }

  activate(): void {
    if (this.mode !== "dormant") return;
    this.mode = "wander";
    this.pickNewWanderDirection();
  }

  reset(): void {
    this.position.copy(GHOST_SPAWN_POINT);
    this.mode = "dormant";
    this.wanderTimeRemaining = 0;
  }

  update(playerPosition: Vector3, deltaSeconds: number): void {
    if (this.mode === "dormant") return;

    const distance = this.position.distanceTo(playerPosition);
    if (this.mode === "wander" && distance <= GHOST_DETECT_RADIUS) {
      this.mode = "chase";
    } else if (this.mode === "chase" && distance > GHOST_LOSE_RADIUS) {
      this.mode = "wander";
      this.pickNewWanderDirection();
    }

    if (this.mode === "chase") {
      toPlayer.copy(playerPosition).sub(this.position);
      moveOnSphere(this.position, toPlayer, GHOST_SPEED, deltaSeconds, PLANET_RADIUS);
      return;
    }

    this.wanderTimeRemaining -= deltaSeconds;
    if (this.wanderTimeRemaining <= 0) this.pickNewWanderDirection();
    moveOnSphere(this.position, this.wanderDirection, GHOST_SPEED * GHOST_WANDER_SPEED_FACTOR, deltaSeconds, PLANET_RADIUS);
  }

  private pickNewWanderDirection(): void {
    up.copy(this.position).normalize();
    randomTangent.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    projection.copy(up).multiplyScalar(randomTangent.dot(up));
    randomTangent.sub(projection);
    if (randomTangent.lengthSq() < 1e-6) randomTangent.set(1, 0, 0);
    this.wanderDirection.copy(randomTangent).normalize();
    this.wanderTimeRemaining =
      WANDER_MIN_DURATION_SECONDS + Math.random() * (WANDER_MAX_DURATION_SECONDS - WANDER_MIN_DURATION_SECONDS);
  }
}
