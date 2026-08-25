import { Vector3 } from "three";
import { PLAYER_SPEED, PLAYER_TURN_RATE_RADIANS_PER_SECOND } from "./Constants.ts";
import { isPositionLegal } from "./MazeGraph.ts";

const scratchMoveDirection = new Vector3();

// Flat XZ-plane movement. Only `forward` (and therefore the chase camera
// anchored to it) keeps the turn-rate-limited behaviour from an earlier
// playtest fix: position always moves exactly where camera-relative input
// says; facing only turns toward it at a capped rate, so backing away or
// strafing turns the player -- and the camera -- around to look back over
// time instead of snapping.
export class Player {
  readonly position: Vector3;
  readonly forward: Vector3;

  constructor(spawn: Vector3, initialForward: Vector3) {
    this.position = spawn.clone();
    this.forward = initialForward.clone().normalize();
  }

  move(moveDirection: Vector3, deltaSeconds: number): void {
    scratchMoveDirection.copy(moveDirection).setY(0);
    if (scratchMoveDirection.lengthSq() <= 1e-8) return;

    scratchMoveDirection.normalize();
    const turnAngle = this.forward.angleTo(scratchMoveDirection);
    if (turnAngle > 1e-6) {
      const turnStep = Math.min(1, (PLAYER_TURN_RATE_RADIANS_PER_SECOND * deltaSeconds) / turnAngle);
      this.forward.lerp(scratchMoveDirection, turnStep).setY(0).normalize();
    }

    const stepX = scratchMoveDirection.x * PLAYER_SPEED * deltaSeconds;
    const stepZ = scratchMoveDirection.z * PLAYER_SPEED * deltaSeconds;
    const { x, z } = this.position;

    // Candidate move against the maze's walls: try the full 2D step first;
    // sliding along whichever single axis is still open (rather than simply
    // refusing the move) is what lets running diagonally into a corner keep
    // sliding along the wall instead of stopping dead.
    if (isPositionLegal(x + stepX, z + stepZ)) {
      this.position.x += stepX;
      this.position.z += stepZ;
    } else if (isPositionLegal(x + stepX, z)) {
      this.position.x += stepX;
    } else if (isPositionLegal(x, z + stepZ)) {
      this.position.z += stepZ;
    }
  }
}
