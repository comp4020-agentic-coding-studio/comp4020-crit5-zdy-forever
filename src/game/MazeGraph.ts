import { Vector3 } from "three";
import { MAZE_CELL_SIZE, MAZE_CORRIDOR_HALF_WIDTH, PLAYER_COLLISION_RADIUS } from "./Constants.ts";
import {
  EXIT_CELL,
  MAZE_COLS,
  MAZE_ROWS,
  SECRET_DOOR_POSITION,
  SPAWN_CELL,
  SPAWN_POINT,
  cellCenter,
  neighboursOf,
  openingsOf,
} from "./Maze.ts";

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const HALF_PITCH = MAZE_CELL_SIZE / 2;
const WALL_STOP = MAZE_CORRIDOR_HALF_WIDTH - PLAYER_COLLISION_RADIUS;

// One rect per cell, each side either running the full half-pitch to the
// neighbouring cell's centre (an open doorway -- the two cells' rects then
// meet flush at the shared boundary with no gap and no double margin) or
// stopping short by PLAYER_COLLISION_RADIUS (a real wall). No separate
// "passage rect" is needed: an open side already reaches exactly as far as
// the neighbour's own rect reaches back.
function buildCellRect(row: number, col: number): Rect {
  const center = cellCenter(row, col);
  const { leftOpen, rightOpen, upOpen, downOpen } = openingsOf(row, col);

  return {
    minX: center.x - (leftOpen ? HALF_PITCH : WALL_STOP),
    maxX: center.x + (rightOpen ? HALF_PITCH : WALL_STOP),
    minZ: center.z - (upOpen ? HALF_PITCH : WALL_STOP),
    maxZ: center.z + (downOpen ? HALF_PITCH : WALL_STOP),
  };
}

// The secret-door easter egg (see Maze.ts::SECRET_DOOR_CELL): bridges spawn's
// own rect straight through to the secret cell's rect along the shared axis,
// covering exactly the gap each cell's own rect stops short of on that side.
function buildSecretDoorRect(): Rect {
  const spawnZ = SPAWN_POINT.z;
  const secretZ = SECRET_DOOR_POSITION.z;
  return {
    minX: SPAWN_POINT.x - WALL_STOP,
    maxX: SPAWN_POINT.x + WALL_STOP,
    minZ: Math.min(spawnZ, secretZ) + WALL_STOP,
    maxZ: Math.max(spawnZ, secretZ) - WALL_STOP,
  };
}

export const COLLISION_RECTS: readonly Rect[] = (() => {
  const rects: Rect[] = [];
  for (let row = 0; row < MAZE_ROWS; row++) {
    for (let col = 0; col < MAZE_COLS; col++) {
      rects.push(buildCellRect(row, col));
    }
  }
  rects.push(buildSecretDoorRect());
  return rects;
})();

export function isPositionLegal(x: number, z: number): boolean {
  return COLLISION_RECTS.some((rect) => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ);
}

export function cellOf(position: Vector3): readonly [number, number] {
  const row = Math.min(MAZE_ROWS - 1, Math.max(0, Math.round(position.z / MAZE_CELL_SIZE) + SPAWN_CELL[0]));
  const col = Math.min(MAZE_COLS - 1, Math.max(0, Math.round(position.x / MAZE_CELL_SIZE) + SPAWN_CELL[1]));
  return [row, col];
}

const BFS_DISTANCE_FROM_EXIT: number[][] = (() => {
  const dist: number[][] = Array.from({ length: MAZE_ROWS }, () => Array<number>(MAZE_COLS).fill(-1));
  dist[EXIT_CELL[0]][EXIT_CELL[1]] = 0;
  const queue: Array<readonly [number, number]> = [EXIT_CELL];
  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    for (const [nRow, nCol] of neighboursOf(row, col)) {
      if (dist[nRow][nCol] === -1) {
        dist[nRow][nCol] = dist[row][col] + 1;
        queue.push([nRow, nCol]);
      }
    }
  }
  return dist;
})();

export function bfsDistanceFromExit(row: number, col: number): number {
  return BFS_DISTANCE_FROM_EXIT[row][col];
}

export const SPAWN_BFS_DISTANCE = bfsDistanceFromExit(SPAWN_CELL[0], SPAWN_CELL[1]);
