import { Vector3 } from "three";
import { CORRIDOR_HALF_WIDTH, CORRIDOR_LENGTH } from "./Constants.ts";

export const SPAWN_POINT = new Vector3(0, 0, 0);
export const SPAWN_FORWARD = new Vector3(0, 0, 1);
export const EXIT_POSITION = new Vector3(0, 0, CORRIDOR_LENGTH);

// A single wider chamber partway down the corridor -- visual variety and a
// beat where the player briefly loses the reassurance of close walls, not a
// gameplay rule of its own.
export const CHAMBER_CENTER_Z = CORRIDOR_LENGTH * 0.55;
export const CHAMBER_HALF_LENGTH = 6;
export const CHAMBER_HALF_WIDTH = 5;

export function corridorHalfWidthAt(z: number): number {
  const inChamber = Math.abs(z - CHAMBER_CENTER_Z) <= CHAMBER_HALF_LENGTH;
  return inChamber ? CHAMBER_HALF_WIDTH : CORRIDOR_HALF_WIDTH;
}

// Ceiling light fixtures, spaced along the corridor. The first is
// deliberately always flickering a little regardless of game state (cosmetic
// only) -- environmental foreshadowing for the mechanic before the first
// real blackout ever happens.
export const LIGHT_FIXTURE_SPACING = 5.5;
export const LIGHT_FIXTURE_POSITIONS: readonly Vector3[] = Array.from(
  { length: Math.floor(CORRIDOR_LENGTH / LIGHT_FIXTURE_SPACING) },
  (_, i) => new Vector3(0, 0, (i + 1) * LIGHT_FIXTURE_SPACING),
);
export const DAMAGED_FIXTURE_INDEX = 1;
