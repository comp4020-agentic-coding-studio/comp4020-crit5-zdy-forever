import { Vector3 } from "three";
import {
  END_SCREEN_DELAY_SECONDS,
  EXIT_TRIGGER_RADIUS,
  FINAL_DARK_SECONDS,
  FINAL_STRETCH_DISTANCE_FROM_EXIT,
  GHOST_LOSS_THRESHOLD,
  GHOST_PENALTY_PER_SECOND,
} from "./Constants.ts";
import { EXIT_POSITION, SPAWN_FORWARD, SPAWN_POINT } from "./Corridor.ts";
import { applyDarknessPenalty, checkExitReached, checkGhostCaught, isIllegalMovement } from "./GameRules.ts";
import { transition, type Phase } from "./GameState.ts";
import { Ghost } from "./Ghost.ts";
import { LightController } from "./LightController.ts";
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

  // True for exactly the frames GameRules just penalised a move made in the
  // dark -- the render/audio layers read this to cue footsteps, rather than
  // the raw movement input.
  illegalMovementNow = false;

  private darknessElapsedSeconds = 0;
  private endScreenTimer = 0;
  private finalStretchTriggered = false;
  private readonly moveDirection = new Vector3();

  constructor() {
    this.player = new Player(SPAWN_POINT, SPAWN_FORWARD);
    this.ghost = new Ghost();
    this.light = new LightController();
  }

  // 0 at spawn, 1 at the exit -- what LightController's difficulty tiers and
  // the final-stretch trigger are keyed on, rather than wall-clock time.
  get progress(): number {
    return Math.min(1, Math.max(0, this.player.position.z / EXIT_POSITION.z));
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
    this.illegalMovementNow = false;
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

    const distanceToExit = EXIT_POSITION.z - this.player.position.z;
    if (!this.finalStretchTriggered && distanceToExit <= FINAL_STRETCH_DISTANCE_FROM_EXIT) {
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
    } else if (checkExitReached(this.player.position.z, EXIT_POSITION.z, EXIT_TRIGGER_RADIUS)) {
      this.phase = transition(this.phase, { type: "exitReached" });
      this.endScreenTimer = END_SCREEN_DELAY_SECONDS;
    }
  }
}
