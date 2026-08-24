import { Vector3 } from "three";
import { transition, type Phase } from "./GameState.ts";
import { Player } from "./Player.ts";
import { SPAWN_FORWARD, SPAWN_POINT } from "./World.ts";

export interface Movement {
  readonly x: number;
  readonly y: number;
}

// Orchestrates the pure rules (GameState) and the entities (Player, and
// later Ghost/NPC/Rocket) against real input and a real clock. Nothing in
// here imports Three.js -- the render layer reads positions back out of it.
export class Game {
  phase: Phase = "start";
  readonly player: Player;

  private readonly moveDirection = new Vector3();

  constructor() {
    this.player = new Player(SPAWN_POINT, SPAWN_FORWARD);
  }

  begin(): void {
    this.phase = transition(this.phase, { type: "start" });
  }

  update(movement: Movement, groundForward: Vector3, groundRight: Vector3, deltaSeconds: number): void {
    if (this.phase !== "playing") return;

    this.moveDirection.copy(groundRight).multiplyScalar(movement.x).addScaledVector(groundForward, movement.y);
    this.player.move(this.moveDirection, deltaSeconds);
  }
}
