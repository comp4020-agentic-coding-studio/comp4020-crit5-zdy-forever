import { Vector3 } from "three";
import {
  CORRIDOR_BACK_WALL_Z,
  CORRIDOR_LENGTH,
  CORRIDOR_SIDE_MARGIN,
  PLAYER_SPEED,
  PLAYER_TURN_RATE_RADIANS_PER_SECOND,
} from "./Constants.ts";
import { corridorHalfWidthAt } from "./Corridor.ts";

const scratchMoveDirection = new Vector3();

// Flat XZ-plane movement -- much simpler than LAST SIGNAL's great-circle
// sphere math now that the level is a straight corridor, not a planet. Only
// `forward` (and therefore the chase camera anchored to it) keeps the
// turn-rate-limited behaviour from that playtest fix: position always moves
// exactly where camera-relative input says; facing only turns toward it at a
// capped rate, so backing away or strafing turns the player -- and the
// camera -- around to look back over time instead of snapping.
export class Player {
  readonly position: Vector3;
  readonly forward: Vector3;

  constructor(spawn: Vector3, initialForward: Vector3) {
    this.position = spawn.clone();
    this.forward = initialForward.clone().normalize();
  }

  move(moveDirection: Vector3, deltaSeconds: number): void {
    scratchMoveDirection.copy(moveDirection).setY(0);
    if (scratchMoveDirection.lengthSq() > 1e-8) {
      scratchMoveDirection.normalize();
      this.position.addScaledVector(scratchMoveDirection, PLAYER_SPEED * deltaSeconds);

      const turnAngle = this.forward.angleTo(scratchMoveDirection);
      if (turnAngle > 1e-6) {
        const turnStep = Math.min(1, (PLAYER_TURN_RATE_RADIANS_PER_SECOND * deltaSeconds) / turnAngle);
        this.forward.lerp(scratchMoveDirection, turnStep).setY(0).normalize();
      }
    }

    const halfWidth = corridorHalfWidthAt(this.position.z) - CORRIDOR_SIDE_MARGIN;
    this.position.x = Math.min(Math.max(this.position.x, -halfWidth), halfWidth);
    this.position.z = Math.min(Math.max(this.position.z, CORRIDOR_BACK_WALL_Z), CORRIDOR_LENGTH + 3);
  }
}
