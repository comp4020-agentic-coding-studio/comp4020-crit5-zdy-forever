import { Vector3 } from "three";
import {
  END_SCREEN_DELAY_SECONDS,
  EXIT_TRIGGER_RADIUS,
  FINAL_DARK_SECONDS,
  FINAL_STRETCH_DISTANCE_FROM_EXIT,
  GHOST_INITIAL_DISTANCE,
  GHOST_LOSS_THRESHOLD,
  GHOST_PENALTY_PER_SECOND,
  GHOST_TRAIL_MAX_ARC_LENGTH,
  GHOST_TRAIL_MIN_SPACING,
} from "./Constants.ts";
import { applyDarknessPenalty, checkExitReached, checkGhostCaught, isIllegalMovement } from "./GameRules.ts";
import { transition, type Phase } from "./GameState.ts";
import { Ghost } from "./Ghost.ts";
import { LightController } from "./LightController.ts";
import { EXIT_POSITION, SPAWN_FORWARD, SPAWN_POINT } from "./Maze.ts";
import { SPAWN_BFS_DISTANCE, bfsDistanceFromExit, cellOf } from "./MazeGraph.ts";
import { Player } from "./Player.ts";

export interface Movement {
  readonly x: number;
  readonly y: number;
}

// Orchestrates the pure rules (GameRules/GameState) and the entities
// (Player, Ghost, LightController) against real input and a real clock.
// Nothing in here imports Three.js -- the render layer reads state back out.
export class Game {
  phase: Phase = "start";
  readonly player: Player;
  readonly ghost: Ghost;
  readonly light: LightController;

  // Breadcrumb trail of the player's actual world XZ positions, oldest
  // first -- Ghost.positionBehind walks backward along it so the ghost's
  // rendered position always sits on ground the player genuinely walked
  // through the maze, never cutting through a wall. Purely a rendering
  // concern; the actual ghost.distance rule below is unaffected.
  readonly trail: Vector3[] = [];

  // True for exactly the frames GameRules just penalised a move made in the
  // dark -- the render/audio layers read this to cue footsteps, rather than
  // the raw movement input.
  illegalMovementNow = false;

  private darknessElapsedSeconds = 0;
  private endScreenTimer = 0;
  private finalStretchTriggered = false;
  // High-water mark of BFS-steps-to-exit reached so far -- never regresses,
  // so wandering into a dead end and backtracking can't ease the difficulty
  // tier back down (a literal "distance from current cell" would).
  private minBfsDistanceReached = SPAWN_BFS_DISTANCE;
  private readonly moveDirection = new Vector3();

  constructor() {
    this.player = new Player(SPAWN_POINT, SPAWN_FORWARD);
    this.ghost = new Ghost();
    this.light = new LightController();
    this.seedTrail();
  }

  // 0 at spawn, 1 at the exit -- keyed on the maze graph's own topology
  // (BFS steps to the exit), not straight-line distance, since a straight
  // line can cut through walls a real path can't.
  get progress(): number {
    return 1 - Math.min(1, Math.max(0, this.minBfsDistanceReached / SPAWN_BFS_DISTANCE));
  }

  // null until a win/loss has landed AND its short reveal delay has passed.
  get endScreenText(): string | null {
    if (this.phase === "lost" && this.endScreenTimer <= 0) return "FOUND";
    if (this.phase === "won" && this.endScreenTimer <= 0) return "ESCAPED";
    return null;
  }

  begin(): void {
    this.phase = transition(this.phase, { type: "start" });
  }

  reset(): void {
    this.player.position.copy(SPAWN_POINT);
    this.player.forward.copy(SPAWN_FORWARD).normalize();
    this.ghost.reset();
    this.light.reset();
    this.darknessElapsedSeconds = 0;
    this.endScreenTimer = 0;
    this.finalStretchTriggered = false;
    this.minBfsDistanceReached = SPAWN_BFS_DISTANCE;
    this.illegalMovementNow = false;
    this.seedTrail();
    this.phase = transition(this.phase, { type: "restart" });
  }

  private seedTrail(): void {
    // Oldest (farthest behind) first, newest (the player's own position)
    // last -- positionBehind walks backward from the last entry, so the
    // order here has to match how updateTrail appends going forward.
    this.trail.length = 0;
    this.trail.push(SPAWN_POINT.clone().addScaledVector(SPAWN_FORWARD, -GHOST_INITIAL_DISTANCE));
    this.trail.push(SPAWN_POINT.clone());
  }

  private updateTrail(): void {
    const last = this.trail[this.trail.length - 1];
    if (last.distanceTo(this.player.position) > GHOST_TRAIL_MIN_SPACING) {
      this.trail.push(this.player.position.clone());
    }

    let arcLength = 0;
    for (let i = this.trail.length - 1; i > 0; i--) {
      arcLength += this.trail[i].distanceTo(this.trail[i - 1]);
    }
    while (arcLength > GHOST_TRAIL_MAX_ARC_LENGTH && this.trail.length > 2) {
      arcLength -= this.trail[1].distanceTo(this.trail[0]);
      this.trail.shift();
    }
  }

  update(movement: Movement, groundForward: Vector3, groundRight: Vector3, deltaSeconds: number): void {
    if (this.phase !== "playing") {
      this.endScreenTimer = Math.max(0, this.endScreenTimer - deltaSeconds);
      this.illegalMovementNow = false;
      return;
    }

    this.moveDirection.copy(groundRight).multiplyScalar(movement.x).addScaledVector(groundForward, movement.y);
    this.player.move(this.moveDirection, deltaSeconds);
    this.updateTrail();

    const [row, col] = cellOf(this.player.position);
    this.minBfsDistanceReached = Math.min(this.minBfsDistanceReached, bfsDistanceFromExit(row, col));

    const distanceToExit = Math.hypot(EXIT_POSITION.x - this.player.position.x, EXIT_POSITION.z - this.player.position.z);
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
    this.ghost.distance = applyDarknessPenalty(
      this.ghost.distance,
      this.light.state,
      movementMagnitude,
      this.darknessElapsedSeconds,
      deltaSeconds,
      GHOST_PENALTY_PER_SECOND,
    );

    if (checkGhostCaught(this.ghost.distance, GHOST_LOSS_THRESHOLD)) {
      this.phase = transition(this.phase, { type: "ghostCaught" });
      this.endScreenTimer = END_SCREEN_DELAY_SECONDS;
    } else if (checkExitReached(distanceToExit, EXIT_TRIGGER_RADIUS)) {
      this.phase = transition(this.phase, { type: "exitReached" });
      this.endScreenTimer = END_SCREEN_DELAY_SECONDS;
    }
  }
}
