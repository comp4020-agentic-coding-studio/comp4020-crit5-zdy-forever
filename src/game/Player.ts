import { Vector3 } from "three";
import { PLANET_RADIUS, PLAYER_SPEED, PLAYER_TURN_RATE_RADIANS_PER_SECOND } from "./Constants.ts";
import { moveOnSphere } from "./sphereMotion.ts";

export class Player {
  readonly position: Vector3;
  readonly forward: Vector3;

  constructor(spawn: Vector3, initialForward: Vector3) {
    this.position = spawn.clone();
    this.forward = initialForward.clone().normalize();
  }

  get up(): Vector3 {
    return this.position.clone().normalize();
  }

  // moveDirection is a world-space direction; it need not already be tangent
  // to the sphere or unit length -- see moveOnSphere.
  move(moveDirection: Vector3, deltaSeconds: number): void {
    moveOnSphere(
      this.position,
      moveDirection,
      PLAYER_SPEED,
      deltaSeconds,
      PLANET_RADIUS,
      this.forward,
      PLAYER_TURN_RATE_RADIANS_PER_SECOND,
    );
  }
}
