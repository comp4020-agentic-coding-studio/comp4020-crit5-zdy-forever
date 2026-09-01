import type { Vector3 } from "three";
import { MAZE_CELL_SIZE } from "../game/Constants.ts";
import { MAZE_COLS, MAZE_ROWS, openingsOf, SPAWN_CELL } from "../game/Maze.ts";

const CELL_PIXELS = 20;
const PADDING_PIXELS = 6;
const WIDTH = MAZE_COLS * CELL_PIXELS + PADDING_PIXELS * 2;
const HEIGHT = MAZE_ROWS * CELL_PIXELS + PADDING_PIXELS * 2;

function cellIndex(row: number, col: number): number {
  return row * MAZE_COLS + col;
}

// Renders a fixed, non-rotating fog-of-war minimap into a hand-authored
// <canvas> (see CLAUDE.md: Vite doesn't execute JS at build time, so the
// element itself must live in index.html). Only cells the player has
// actually stood in are drawn -- the map's own orientation never changes,
// only the player's facing tick does.
export class MinimapUI {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("DON'T MOVE: 2d canvas context unavailable");
    ctx.scale(dpr, dpr);
    this.ctx = ctx;
  }

  update(visitedCells: ReadonlySet<number>, playerPosition: Vector3, playerForward: Vector3): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgb(3 3 4 / 65%)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        if (!visitedCells.has(cellIndex(row, col))) continue;

        const x = PADDING_PIXELS + col * CELL_PIXELS;
        const y = PADDING_PIXELS + row * CELL_PIXELS;

        ctx.fillStyle = "rgb(216 220 228 / 22%)";
        ctx.fillRect(x, y, CELL_PIXELS, CELL_PIXELS);

        const { leftOpen, rightOpen, upOpen, downOpen } = openingsOf(row, col);
        ctx.strokeStyle = "rgb(216 220 228 / 80%)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (!leftOpen) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + CELL_PIXELS);
        }
        if (!rightOpen) {
          ctx.moveTo(x + CELL_PIXELS, y);
          ctx.lineTo(x + CELL_PIXELS, y + CELL_PIXELS);
        }
        if (!upOpen) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + CELL_PIXELS, y);
        }
        if (!downOpen) {
          ctx.moveTo(x, y + CELL_PIXELS);
          ctx.lineTo(x + CELL_PIXELS, y + CELL_PIXELS);
        }
        ctx.stroke();
      }
    }

    // World -> minimap pixels: spawn cell's centre is the world origin (see
    // Maze.ts::cellCenter), so a world offset in cell units maps directly
    // onto a pixel offset from the spawn cell's pixel centre.
    const px =
      PADDING_PIXELS + (SPAWN_CELL[1] + playerPosition.x / MAZE_CELL_SIZE) * CELL_PIXELS + CELL_PIXELS / 2;
    const py =
      PADDING_PIXELS + (SPAWN_CELL[0] + playerPosition.z / MAZE_CELL_SIZE) * CELL_PIXELS + CELL_PIXELS / 2;

    const facingLength = CELL_PIXELS * 0.6;
    ctx.strokeStyle = "#b8862f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + playerForward.x * facingLength, py + playerForward.z * facingLength);
    ctx.stroke();

    ctx.fillStyle = "#b8862f";
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
