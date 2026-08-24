import { Vector3 } from "three";
import { PLANET_RADIUS } from "./Constants.ts";

// A hand-placed layout, not a procedurally generated one -- small enough that
// the first NPC is found quickly, the tower/beacons stay useful as landmarks,
// and a full round is reachable in a few minutes. Positions are given as
// latitude/longitude in degrees (lat 0 = equator, lon 0 = the spawn meridian)
// and converted to a point on the planet's surface.
function surfacePoint(latDeg: number, lonDeg: number): Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new Vector3(
    PLANET_RADIUS * Math.cos(lat) * Math.sin(lon),
    PLANET_RADIUS * Math.sin(lat),
    PLANET_RADIUS * Math.cos(lat) * Math.cos(lon),
  );
}

export interface NpcDefinition {
  readonly id: string;
  readonly position: Vector3;
  readonly lines: readonly string[];
}

// Spawn near lon 0. NPC 1 is a short walk away so accidental exploration
// finds it almost immediately; the radio tower and NPC 2 are a longer walk
// in one direction, the shelter and NPC 3 in another; the beacon chain and
// rocket sit on the far side, close enough (in longitude) to loop back
// toward the spawn side of the planet rather than being maximally distant.
export const SPAWN_POINT: Vector3 = surfacePoint(4, 0);
export const SPAWN_FORWARD: Vector3 = new Vector3(1, 0, 0);

export const NPCS: readonly NpcDefinition[] = [
  {
    id: "survivor",
    position: surfacePoint(2, 18),
    lines: ["You woke up too.", "The last evacuation ship never launched."],
  },
  {
    id: "signal-keeper",
    position: surfacePoint(10, 95),
    lines: ["The tower went silent hours ago.", "I saw the launch beacons burning beyond it."],
  },
  {
    id: "technician",
    position: surfacePoint(-15, 205),
    lines: ["Those red lights still have power.", "The pad is on the far side."],
  },
];

export const RADIO_TOWER_POSITION: Vector3 = surfacePoint(6, 100);
export const SHELTER_POSITION: Vector3 = surfacePoint(-18, 200);

export const BEACON_POSITIONS: readonly Vector3[] = [
  surfacePoint(-6, 260),
  surfacePoint(-4, 285),
  surfacePoint(-2, 310),
];

export const ROCKET_POSITION: Vector3 = surfacePoint(0, 330);

// Away from the spawn point and not beside any NPC -- the ghost shouldn't be
// visible or a threat in the opening seconds.
export const GHOST_SPAWN_POINT: Vector3 = surfacePoint(-8, 150);
