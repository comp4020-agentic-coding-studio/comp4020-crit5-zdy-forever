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
// tangent plane first. If `forward` is given, it's rotated by the same
// quaternion so orientation follows the curvature. A no-op if the direction
// has (almost) no tangential component, e.g. pointing straight up or down.
export function moveOnSphere(
  position: Vector3,
  moveDirection: Vector3,
  speed: number,
  deltaSeconds: number,
  planetRadius: number,
  forward?: Vector3,
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
  forward?.copy(TANGENT).applyQuaternion(ROTATION);
}
