import { Vector3 } from "three";
import { MAZE_CELL_SIZE, PLAYER_SPEED } from "./Constants.ts";

// Baked once by scripts/generate-maze.ts (seed 265, a 4x4 recursive-
// backtracker spanning tree) and hand-copied here -- this file, not the
// generator script, is the runtime source of truth. Re-running the
// generator with the same seed reproduces this exact layout.
//
// Shrunk again from the 5x5 (18-edge, ~117-unit true path) for an even
// quicker mistake-free run: true path spawn->exit is 12 edges, ~78 units at
// MAZE_CELL_SIZE=6.5, i.e. ~19s of travel if never slowed by a turn -- see
// scripts/generate-maze.ts for the sampled band this was picked from. 3
// genuine dead ends (tree structure, so no accidental shortcuts), two of
// them close to spawn as cheap early red herrings; the third sits much
// farther out along the true path so it isn't given the same treatment.
//
//   +--+--+--+--+
//   |E |        |
//   +  +  +  +--+
//   |  |S |     |
//   +  +--+  +  +
//   |     |  |  |
//   +--+  +--+  +
//   |           |
//   +--+--+--+--+
//
export const MAZE_ROWS = 4;
export const MAZE_COLS = 4;

// horizontalOpenings[row] -- COLS-1 bits, bit c = opening between
// (row, c) and (row, c+1).
export const HORIZONTAL_OPENINGS: readonly string[] = [
  "011",
  "001",
  "100",
  "111",
];

// verticalOpenings[row] (row 0..ROWS-2) -- COLS bits, bit c = opening
// between (row, c) and (row+1, c).
export const VERTICAL_OPENINGS: readonly string[] = [
  "1110",
  "1011",
  "0101",
];

export const SPAWN_CELL: readonly [number, number] = [1, 1]; // [row, col]
export const EXIT_CELL: readonly [number, number] = [0, 0];

export function isHorizontalOpen(row: number, col: number): boolean {
  return HORIZONTAL_OPENINGS[row]?.[col] === "1";
}

export function isVerticalOpen(row: number, col: number): boolean {
  return VERTICAL_OPENINGS[row]?.[col] === "1";
}

// World position of a cell's centre -- spawn sits at the world origin (kept
// deliberately, same convention the straight corridor used) with col -> +X,
// row -> +Z.
export function cellCenter(row: number, col: number, out: Vector3 = new Vector3()): Vector3 {
  return out.set((col - SPAWN_CELL[1]) * MAZE_CELL_SIZE, 0, (row - SPAWN_CELL[0]) * MAZE_CELL_SIZE);
}

export interface CellOpenings {
  readonly leftOpen: boolean;
  readonly rightOpen: boolean;
  readonly upOpen: boolean;
  readonly downOpen: boolean;
}

// Shared by MazeGraph's collision rects and SceneManager's room footprints,
// so "which of a cell's four sides is a real wall" is derived once, not
// re-derived (and risking disagreement) in both places.
export function openingsOf(row: number, col: number): CellOpenings {
  return {
    leftOpen: col > 0 && isHorizontalOpen(row, col - 1),
    rightOpen: col < MAZE_COLS - 1 && isHorizontalOpen(row, col),
    upOpen: row > 0 && isVerticalOpen(row - 1, col),
    downOpen: row < MAZE_ROWS - 1 && isVerticalOpen(row, col),
  };
}

export function neighboursOf(row: number, col: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (col > 0 && isHorizontalOpen(row, col - 1)) out.push([row, col - 1]);
  if (col < MAZE_COLS - 1 && isHorizontalOpen(row, col)) out.push([row, col + 1]);
  if (row > 0 && isVerticalOpen(row - 1, col)) out.push([row - 1, col]);
  if (row < MAZE_ROWS - 1 && isVerticalOpen(row, col)) out.push([row + 1, col]);
  return out;
}

function singleNeighbourOf(row: number, col: number): [number, number] {
  const neighbours = neighboursOf(row, col);
  if (neighbours.length !== 1) {
    throw new Error(`expected [${row},${col}] to be a degree-1 cell, found degree ${neighbours.length}`);
  }
  return neighbours[0];
}

export const SPAWN_POINT: Vector3 = cellCenter(SPAWN_CELL[0], SPAWN_CELL[1]);
export const EXIT_POSITION: Vector3 = cellCenter(EXIT_CELL[0], EXIT_CELL[1]);

// Derived from spawn's one opening, not hardcoded -- a diameter endpoint of
// a spanning tree always has exactly one neighbour.
export const SPAWN_FORWARD: Vector3 = (() => {
  const [nRow, nCol] = singleNeighbourOf(SPAWN_CELL[0], SPAWN_CELL[1]);
  return cellCenter(nRow, nCol).sub(SPAWN_POINT).normalize();
})();

// Direction of the exit cell's one opening -- SceneManager orients the exit
// door across this axis instead of assuming +Z.
export const EXIT_DOOR_AXIS: Vector3 = (() => {
  const [nRow, nCol] = singleNeighbourOf(EXIT_CELL[0], EXIT_CELL[1]);
  return cellCenter(nRow, nCol).sub(EXIT_POSITION).normalize();
})();

// Easter egg: spawn is a degree-1 node, so turning 180deg from SPAWN_FORWARD
// and walking forward always faces the one wall that's normally closed.
// MazeGraph and SceneManager each special-case just that one edge to open a
// secret door there, independent of isVerticalOpen/neighboursOf (so the real
// graph's BFS distances, dead-end count and spanning-tree property, all
// documented elsewhere, are untouched; this shortcut deliberately isn't part
// of the "real" maze). The door itself sits SECRET_DOOR_TRAVEL_SECONDS of
// straight walking behind spawn, which runs past the real grid's own
// southern boundary into new tunnel geometry SceneManager builds beyond it.
export const SECRET_DOOR_CELL: readonly [number, number] = [SPAWN_CELL[0] + 1, SPAWN_CELL[1]];
const SECRET_DOOR_TRAVEL_SECONDS = 5;
const SECRET_PASSAGE_DIRECTION: Vector3 = cellCenter(SECRET_DOOR_CELL[0], SECRET_DOOR_CELL[1])
  .sub(SPAWN_POINT)
  .normalize();
export const SECRET_DOOR_POSITION: Vector3 = SPAWN_POINT.clone().addScaledVector(
  SECRET_PASSAGE_DIRECTION,
  PLAYER_SPEED * SECRET_DOOR_TRAVEL_SECONDS,
);
export const SECRET_DOOR_AXIS: Vector3 = SPAWN_POINT.clone().sub(SECRET_DOOR_POSITION).normalize();

// Ceiling light fixtures: one per open cell (including spawn/exit), at the
// cell centre. A handful near early dead-end branches flicker constantly
// regardless of game state -- the same cosmetic foreshadowing the straight
// corridor had, generalised from a single index to a set, used here to
// subtly mark cheap-to-explore red herrings near spawn without any text.
export const LIGHT_FIXTURE_POSITIONS: readonly Vector3[] = (() => {
  const positions: Vector3[] = [];
  for (let row = 0; row < MAZE_ROWS; row++) {
    for (let col = 0; col < MAZE_COLS; col++) {
      positions.push(cellCenter(row, col));
    }
  }
  return positions;
})();

function fixtureIndexOf(row: number, col: number): number {
  return row * MAZE_COLS + col;
}

// Early decoy branches -- the two dead-end leaf cells closest to spawn by
// BFS distance ([0,3] at 3 steps, [2,2] at 4 steps, versus the third dead
// end sitting 9 steps out along the true path), confirmed by walking the
// baked graph rather than eyeballing the ASCII map above.
export const DAMAGED_FIXTURE_INDICES: readonly number[] = [
  fixtureIndexOf(0, 3),
  fixtureIndexOf(2, 2),
];
