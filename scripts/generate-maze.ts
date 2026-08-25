// One-off generator, never imported by the shipped app and never run by
// `pnpm check` -- run by hand (`node scripts/generate-maze.ts`) whenever the
// baked layout needs regenerating. Its stdout (ASCII map + adjacency
// bit-strings) is hand-copied into src/game/Maze.ts, which is the actual
// source of truth the game reads at runtime.
//
// Fixed seed (not Math.random) so re-running this reproduces the same maze --
// "baked once," not "random every time the script happens to run."

const ROWS = 8;
const COLS = 8;
// A plain recursive-backtracker over 8x8 tends to produce tree diameters in
// the mid-30s to mid-50s (sampled 34-57 across 100 seeds), not the 24-28
// originally guessed -- so the target band below is set from that sampled
// reality, not a round number picked before the algorithm was run.
const TARGET_PATH_MIN = 32;
const TARGET_PATH_MAX = 38;
// Sampled across thousands of seeds in the target path-length band, 11 is
// close to the practical ceiling for an 8x8 recursive-backtracker tree (not
// the 12-16 first guessed before actually running the generator) -- 10 is
// set just under that ceiling so the search terminates quickly while still
// landing a genuinely branchy result.
const MIN_LEAVES = 10;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MazeResult {
  horizontalOpen: boolean[][]; // [row][col]: opening between (row,col) and (row,col+1) -- COLS-1 per row
  verticalOpen: boolean[][]; // [row][col]: opening between (row,col) and (row+1,col) -- ROWS-1 per col
  edgeCount: number;
}

function cellIndex(row: number, col: number): number {
  return row * COLS + col;
}

function generateSpanningTree(rng: () => number): MazeResult {
  const horizontalOpen: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS - 1).fill(false));
  const verticalOpen: boolean[][] = Array.from({ length: ROWS - 1 }, () => Array(COLS).fill(false));
  const visited = new Set<number>();
  const stack: [number, number][] = [];

  const start: [number, number] = [0, 0];
  visited.add(cellIndex(...start));
  stack.push(start);
  let edgeCount = 0;

  while (stack.length > 0) {
    const [row, col] = stack[stack.length - 1];
    const neighbours: Array<[number, number, () => void]> = [];
    if (row > 0 && !visited.has(cellIndex(row - 1, col))) {
      neighbours.push([row - 1, col, () => (verticalOpen[row - 1][col] = true)]);
    }
    if (row < ROWS - 1 && !visited.has(cellIndex(row + 1, col))) {
      neighbours.push([row + 1, col, () => (verticalOpen[row][col] = true)]);
    }
    if (col > 0 && !visited.has(cellIndex(row, col - 1))) {
      neighbours.push([row, col - 1, () => (horizontalOpen[row][col - 1] = true)]);
    }
    if (col < COLS - 1 && !visited.has(cellIndex(row, col + 1))) {
      neighbours.push([row, col + 1, () => (horizontalOpen[row][col] = true)]);
    }

    if (neighbours.length === 0) {
      stack.pop();
      continue;
    }

    const [nextRow, nextCol, openEdge] = neighbours[Math.floor(rng() * neighbours.length)];
    openEdge();
    edgeCount++;
    visited.add(cellIndex(nextRow, nextCol));
    stack.push([nextRow, nextCol]);
  }

  return { horizontalOpen, verticalOpen, edgeCount };
}

function neighboursOf(row: number, col: number, maze: MazeResult): [number, number][] {
  const out: [number, number][] = [];
  if (col > 0 && maze.horizontalOpen[row][col - 1]) out.push([row, col - 1]);
  if (col < COLS - 1 && maze.horizontalOpen[row][col]) out.push([row, col + 1]);
  if (row > 0 && maze.verticalOpen[row - 1][col]) out.push([row - 1, col]);
  if (row < ROWS - 1 && maze.verticalOpen[row][col]) out.push([row + 1, col]);
  return out;
}

function bfs(start: [number, number], maze: MazeResult): { dist: number[][]; farthest: [number, number]; maxDist: number } {
  const dist: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  dist[start[0]][start[1]] = 0;
  const queue: [number, number][] = [start];
  let farthest: [number, number] = start;
  let maxDist = 0;

  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    for (const [nr, nc] of neighboursOf(row, col, maze)) {
      if (dist[nr][nc] === -1) {
        dist[nr][nc] = dist[row][col] + 1;
        if (dist[nr][nc] > maxDist) {
          maxDist = dist[nr][nc];
          farthest = [nr, nc];
        }
        queue.push([nr, nc]);
      }
    }
  }
  return { dist, farthest, maxDist };
}

function degreeOf(row: number, col: number, maze: MazeResult): number {
  return neighboursOf(row, col, maze).length;
}

function renderAscii(maze: MazeResult, spawn: [number, number], exit: [number, number]): string {
  const lines: string[] = [];
  let top = "+";
  for (let c = 0; c < COLS; c++) top += "--+";
  lines.push(top);

  for (let r = 0; r < ROWS; r++) {
    let rowLine = "|";
    for (let c = 0; c < COLS; c++) {
      const isSpawn = spawn[0] === r && spawn[1] === c;
      const isExit = exit[0] === r && exit[1] === c;
      const label = isSpawn ? "S " : isExit ? "E " : "  ";
      rowLine += label;
      rowLine += c < COLS - 1 && maze.horizontalOpen[r][c] ? " " : "|";
    }
    lines.push(rowLine);

    let sepLine = "+";
    for (let c = 0; c < COLS; c++) {
      sepLine += r < ROWS - 1 && maze.verticalOpen[r][c] ? "  " : "--";
      sepLine += "+";
    }
    lines.push(sepLine);
  }
  return lines.join("\n");
}

function bitString(rows: boolean[][]): string[] {
  return rows.map((row) => row.map((open) => (open ? "1" : "0")).join(""));
}

function countLeaves(maze: MazeResult, spawn: [number, number], exit: [number, number]): number {
  let leaves = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isEndpoint = (r === spawn[0] && c === spawn[1]) || (r === exit[0] && c === exit[1]);
      if (!isEndpoint && degreeOf(r, c, maze) === 1) leaves++;
    }
  }
  return leaves;
}

let seed = 1337;
let attempt = 0;
let maze: MazeResult;
let spawn: [number, number];
let exit: [number, number];
let pathLength: number;

while (true) {
  attempt++;
  const rng = mulberry32(seed);
  maze = generateSpanningTree(rng);

  const fromArbitrary = bfs([0, 0], maze);
  const fromU = bfs(fromArbitrary.farthest, maze);
  spawn = fromArbitrary.farthest;
  exit = fromU.farthest;
  pathLength = fromU.maxDist;

  const totalEdges = maze.edgeCount;
  const allVisited = bfs([0, 0], maze).dist.every((row) => row.every((d) => d !== -1));

  if (totalEdges !== ROWS * COLS - 1 || !allVisited) {
    throw new Error(`generator self-check failed at seed ${seed}: edges=${totalEdges}, allVisited=${allVisited}`);
  }

  if (
    pathLength >= TARGET_PATH_MIN &&
    pathLength <= TARGET_PATH_MAX &&
    degreeOf(...spawn, maze) === 1 &&
    degreeOf(...exit, maze) === 1 &&
    countLeaves(maze, spawn, exit) >= MIN_LEAVES
  ) {
    break;
  }
  seed++;
  if (attempt > 5000) throw new Error("could not find a maze matching the target path length after 5000 seeds");
}

console.log(`seed=${seed} attempts=${attempt} pathLength(edges)=${pathLength} leaves=${countLeaves(maze, spawn, exit)}`);
console.log(`spawn=[${spawn.join(",")}] exit=[${exit.join(",")}]`);
console.log();
console.log(renderAscii(maze, spawn, exit));
console.log();
console.log("HORIZONTAL_OPENINGS (per row, COLS-1 bits: opening between col c and c+1):");
console.log(JSON.stringify(bitString(maze.horizontalOpen)));
console.log();
console.log("VERTICAL_OPENINGS (per row 0..ROWS-2, COLS bits: opening between this row and row+1):");
console.log(JSON.stringify(bitString(maze.verticalOpen)));
