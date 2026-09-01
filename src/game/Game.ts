import { Vector3 } from "three";
import {
  DARKNESS_DEATH_SECONDS,
  END_SCREEN_DELAY_SECONDS,
  EXIT_TRIGGER_RADIUS,
  FINAL_DARK_SECONDS,
  FINAL_STRETCH_DISTANCE_FROM_EXIT,
} from "./Constants.ts";
import { accumulateDarknessSeconds, checkDarknessDeath, checkExitReached, isIllegalMovement } from "./GameRules.ts";
import { transition, type Phase } from "./GameState.ts";
import { LightController } from "./LightController.ts";
import { EXIT_POSITION, MAZE_COLS, SECRET_DOOR_POSITION, SPAWN_CELL, SPAWN_FORWARD, SPAWN_POINT } from "./Maze.ts";
import { SPAWN_BFS_DISTANCE, bfsDistanceFromExit, cellOf } from "./MazeGraph.ts";
import { Player } from "./Player.ts";

export interface Movement {
  readonly x: number;
  readonly y: number;
}

function cellIndex(row: number, col: number): number {
  return row * MAZE_COLS + col;
}

// Orchestrates the pure rules (GameRules/GameState) and the entities
// (Player, LightController) against real input and a real clock. Nothing in
// here imports Three.js -- the render layer reads state back out.
export class Game {
  phase: Phase = "start";
  readonly player: Player;
  readonly light: LightController;

  // Grid cells the player has actually stood in, keyed by row*MAZE_COLS+col
  // -- the minimap's fog-of-war reveal reads this directly.
  readonly visitedCells = new Set<number>();

  // True for exactly the frames GameRules just penalised a move made in the
  // dark -- the render/audio layers read this to cue footsteps, rather than
  // the raw movement input.
  illegalMovementNow = false;

  private darknessElapsedSeconds = 0;
  // Cumulative seconds of illegal movement in the dark -- see
  // GameRules.accumulateDarknessSeconds. Only reset() clears it.
  private darknessActionSeconds = 0;
  private endScreenTimer = 0;
  private finalStretchTriggered = false;
  // High-water mark of BFS-steps-to-exit reached so far -- never regresses,
  // so wandering into a dead end and backtracking can't ease the difficulty
  // tier back down (a literal "distance from current cell" would).
  private minBfsDistanceReached = SPAWN_BFS_DISTANCE;
  private readonly moveDirection = new Vector3();

  constructor() {
    this.player = new Player(SPAWN_POINT, SPAWN_FORWARD);
    this.light = new LightController();
    this.visitedCells.add(cellIndex(SPAWN_CELL[0], SPAWN_CELL[1]));
  }

  // 0 at spawn, 1 at the exit -- keyed on the maze graph's own topology
  // (BFS steps to the exit), not straight-line distance, since a straight
  // line can cut through walls a real path can't.
  get progress(): number {
    return 1 - Math.min(1, Math.max(0, this.minBfsDistanceReached / SPAWN_BFS_DISTANCE));
  }

  // 0 (safe) to 1 (about to die) -- driven by cumulative illegal-movement
  // seconds in the dark, not a proximity metric, since there's no longer a
  // pursuer to be near. Drives the vignette, camera dread and audio danger
  // cues in main.ts.
  get danger(): number {
    return Math.min(1, this.darknessActionSeconds / DARKNESS_DEATH_SECONDS);
  }

  // null until a win/loss has landed AND its short reveal delay has passed.
  get endScreenText(): string | null {
    if (this.phase === "lost" && this.endScreenTimer <= 0) return "DIE";
    if (this.phase === "won" && this.endScreenTimer <= 0) return "ESCAPED";
    return null;
  }

  begin(): void {
    this.phase = transition(this.phase, { type: "start" });
  }

  reset(): void {
    this.player.position.copy(SPAWN_POINT);
    this.player.forward.copy(SPAWN_FORWARD).normalize();
    this.light.reset();
    this.darknessElapsedSeconds = 0;
    this.darknessActionSeconds = 0;
    this.endScreenTimer = 0;
    this.finalStretchTriggered = false;
    this.minBfsDistanceReached = SPAWN_BFS_DISTANCE;
    this.illegalMovementNow = false;
    this.visitedCells.clear();
    this.visitedCells.add(cellIndex(SPAWN_CELL[0], SPAWN_CELL[1]));
    this.phase = transition(this.phase, { type: "restart" });
  }

  update(movement: Movement, groundForward: Vector3, groundRight: Vector3, deltaSeconds: number): void {
    if (this.phase !== "playing") {
      this.endScreenTimer = Math.max(0, this.endScreenTimer - deltaSeconds);
      this.illegalMovementNow = false;
      return;
    }

    this.moveDirection.copy(groundRight).multiplyScalar(movement.x).addScaledVector(groundForward, movement.y);
    this.player.move(this.moveDirection, deltaSeconds);

    const [row, col] = cellOf(this.player.position);
    this.visitedCells.add(cellIndex(row, col));
    this.minBfsDistanceReached = Math.min(this.minBfsDistanceReached, bfsDistanceFromExit(row, col));

    const distanceToExit = Math.hypot(EXIT_POSITION.x - this.player.position.x, EXIT_POSITION.z - this.player.position.z);
    // The easter-egg secret door behind spawn (see Maze.ts::SECRET_DOOR_CELL)
    // wins the same way the real exit does -- same trigger radius, same
    // transition, same end text.
    const distanceToSecretDoor = Math.hypot(
      SECRET_DOOR_POSITION.x - this.player.position.x,
      SECRET_DOOR_POSITION.z - this.player.position.z,
    );
    // Gated on both the geometric distance AND the graph distance, so a
    // dead end that happens to sit physically close to the exit (through a
    // wall) can't misfire the forced-blackout finale.
    if (
      !this.finalStretchTriggered &&
      distanceToExit <= FINAL_STRETCH_DISTANCE_FROM_EXIT &&
      bfsDistanceFromExit(row, col) <= 1
    ) {
      this.finalStretchTriggered = true;
      this.light.forceDark(FINAL_DARK_SECONDS);
    }

    this.light.update(this.progress, deltaSeconds);
    this.darknessElapsedSeconds = this.light.state === "dark" ? this.darknessElapsedSeconds + deltaSeconds : 0;

    const movementMagnitude = Math.hypot(movement.x, movement.y);
    this.illegalMovementNow = isIllegalMovement(this.light.state, movementMagnitude, this.darknessElapsedSeconds);
    this.darknessActionSeconds = accumulateDarknessSeconds(
      this.darknessActionSeconds,
      this.light.state,
      movementMagnitude,
      this.darknessElapsedSeconds,
      deltaSeconds,
    );

    if (checkDarknessDeath(this.darknessActionSeconds, DARKNESS_DEATH_SECONDS)) {
      this.phase = transition(this.phase, { type: "diedInDarkness" });
      this.endScreenTimer = END_SCREEN_DELAY_SECONDS;
    } else if (
      checkExitReached(distanceToExit, EXIT_TRIGGER_RADIUS) ||
      checkExitReached(distanceToSecretDoor, EXIT_TRIGGER_RADIUS)
    ) {
      this.phase = transition(this.phase, { type: "exitReached" });
      this.endScreenTimer = END_SCREEN_DELAY_SECONDS;
    }
  }
}
