import { Quaternion, Vector3 } from "three";

const UP = new Vector3();
const PROJECTION = new Vector3();
const TANGENT = new Vector3();
const AXIS = new Vector3();
const ROTATION = new Quaternion();

// Rotates `position` along the great circle toward `moveDirection`, which
// preserves its exact distance from the planet's centre regardless of frame
// rate or planet size -- unlike projecting onto the tangent plane and
// renormalizing, which drifts under large steps. `moveDirection` need not be
// tangent to the sphere or unit length; it's projected onto the local
// tangent plane first. A no-op if the direction has (almost) no tangential
// component, e.g. pointing straight up or down.
//
// `forward`, if given, is the caller's facing direction -- carried along the
// same great-circle step so it stays tangent to the sphere, then turned
// toward the actual movement direction. Without `turnRateRadiansPerSecond` it
// snaps straight to it (fine for something with no camera hanging off its
// facing, e.g. the ghost); with a turn rate, it slews at that limited angular
// speed instead, so a camera anchored behind `forward` doesn't whip around
// every time movement direction changes -- see
// PLAYER_TURN_RATE_RADIANS_PER_SECOND.
export function moveOnSphere(
  position: Vector3,
  moveDirection: Vector3,
  speed: number,
  deltaSeconds: number,
  planetRadius: number,
  forward?: Vector3,
  turnRateRadiansPerSecond?: number,
): void {
  if (moveDirection.lengthSq() < 1e-8) return;

  UP.copy(position).normalize();
  PROJECTION.copy(UP).multiplyScalar(moveDirection.dot(UP));
  TANGENT.copy(moveDirection).sub(PROJECTION);
  if (TANGENT.lengthSq() < 1e-8) return;
  TANGENT.normalize();

  const angle = (speed * deltaSeconds) / planetRadius;
  AXIS.crossVectors(UP, TANGENT).normalize();
  ROTATION.setFromAxisAngle(AXIS, angle);

  position.applyQuaternion(ROTATION);
  if (!forward) return;

  forward.applyQuaternion(ROTATION);
  TANGENT.applyQuaternion(ROTATION);

  if (turnRateRadiansPerSecond === undefined) {
    forward.copy(TANGENT);
    return;
  }

  const turnAngle = forward.angleTo(TANGENT);
  if (turnAngle < 1e-6) return;
  const turnStep = Math.min(1, (turnRateRadiansPerSecond * deltaSeconds) / turnAngle);
  forward.lerp(TANGENT, turnStep);

  UP.copy(position).normalize();
  forward.addScaledVector(UP, -forward.dot(UP)).normalize();
}
