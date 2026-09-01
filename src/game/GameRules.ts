import type { LightState } from "./LightController.ts";
import { MOVEMENT_THRESHOLD, REACTION_GRACE_PERIOD_SECONDS } from "./Constants.ts";

// Pure rules -- no Three.js, no DOM, no wall clock beyond the deltas/elapsed
// values passed in. This is exactly what spec/rules.test.ts exercises
// directly: the one rule DON'T MOVE hangs off, moving in the dark counts
// toward death.

export function isIllegalMovement(
  lightState: LightState,
  movementMagnitude: number,
  darknessElapsedSeconds: number,
): boolean {
  if (lightState !== "dark") return false;
  if (darknessElapsedSeconds < REACTION_GRACE_PERIOD_SECONDS) return false;
  return movementMagnitude > MOVEMENT_THRESHOLD;
}

// Cumulative seconds spent actually moving illegally in the dark -- never
// resets except on a full game reset, so several short dashes across
// separate dark cycles add up toward the same death threshold rather than
// each getting a clean slate.
export function accumulateDarknessSeconds(
  accumulatedSeconds: number,
  lightState: LightState,
  movementMagnitude: number,
  darknessElapsedSeconds: number,
  deltaSeconds: number,
): number {
  if (!isIllegalMovement(lightState, movementMagnitude, darknessElapsedSeconds)) return accumulatedSeconds;
  return accumulatedSeconds + deltaSeconds;
}

export function checkDarknessDeath(accumulatedSeconds: number, deathThresholdSeconds: number): boolean {
  return accumulatedSeconds >= deathThresholdSeconds;
}

export function checkExitReached(distanceToExit: number, triggerRadius: number): boolean {
  return distanceToExit <= triggerRadius;
}
