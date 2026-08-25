import type { LightState } from "./LightController.ts";
import { MOVEMENT_THRESHOLD, REACTION_GRACE_PERIOD_SECONDS } from "./Constants.ts";

// Pure rules -- no Three.js, no DOM, no wall clock beyond the deltas/elapsed
// values passed in. This is exactly what spec/rules.test.ts exercises
// directly: the one rule DON'T MOVE hangs off, moving in the dark brings the
// ghost closer.

export function isIllegalMovement(
  lightState: LightState,
  movementMagnitude: number,
  darknessElapsedSeconds: number,
): boolean {
  if (lightState !== "dark") return false;
  if (darknessElapsedSeconds < REACTION_GRACE_PERIOD_SECONDS) return false;
  return movementMagnitude > MOVEMENT_THRESHOLD;
}

export function applyDarknessPenalty(
  ghostDistance: number,
  lightState: LightState,
  movementMagnitude: number,
  darknessElapsedSeconds: number,
  deltaSeconds: number,
  penaltyPerSecond: number,
): number {
  if (!isIllegalMovement(lightState, movementMagnitude, darknessElapsedSeconds)) return ghostDistance;
  return Math.max(0, ghostDistance - movementMagnitude * penaltyPerSecond * deltaSeconds);
}

export function checkGhostCaught(ghostDistance: number, lossThreshold: number): boolean {
  return ghostDistance <= lossThreshold;
}

export function checkExitReached(distanceToExit: number, triggerRadius: number): boolean {
  return distanceToExit <= triggerRadius;
}
