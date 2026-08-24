import { Vector3 } from "three";
import { NPC_INTERACTION_RADIUS, NPC_LINE_DURATION_SECONDS } from "./Constants.ts";
import { transition, type Phase } from "./GameState.ts";
import { NPC } from "./NPC.ts";
import { Player } from "./Player.ts";
import { NPCS, SPAWN_FORWARD, SPAWN_POINT } from "./World.ts";

export interface Movement {
  readonly x: number;
  readonly y: number;
}

// Orchestrates the pure rules (GameState) and the entities (Player, NPCs,
// and later Ghost/Rocket) against real input and a real clock. Nothing in
// here imports Three.js -- the render layer reads positions back out of it.
export class Game {
  phase: Phase = "start";
  readonly player: Player;
  readonly npcs: readonly NPC[];

  private activeNpc: NPC | null = null;
  private dialogueLineIndex = 0;
  private dialogueTimer = 0;
  private readonly moveDirection = new Vector3();

  constructor() {
    this.player = new Player(SPAWN_POINT, SPAWN_FORWARD);
    this.npcs = NPCS.map((definition) => new NPC(definition));
  }

  // null when no NPC is in range; otherwise the line currently being shown.
  // Lines advance on a timer -- there's no input to advance them manually.
  get dialogueText(): string | null {
    return this.activeNpc ? this.activeNpc.lines[this.dialogueLineIndex] : null;
  }

  begin(): void {
    this.phase = transition(this.phase, { type: "start" });
  }

  update(movement: Movement, groundForward: Vector3, groundRight: Vector3, deltaSeconds: number): void {
    if (this.phase !== "playing") return;

    this.moveDirection.copy(groundRight).multiplyScalar(movement.x).addScaledVector(groundForward, movement.y);
    this.player.move(this.moveDirection, deltaSeconds);

    this.updateDialogue(deltaSeconds);
  }

  private updateDialogue(deltaSeconds: number): void {
    const nearby = this.npcs.find((npc) => npc.isInRange(this.player.position, NPC_INTERACTION_RADIUS)) ?? null;

    if (nearby !== this.activeNpc) {
      this.activeNpc = nearby;
      this.dialogueLineIndex = 0;
      this.dialogueTimer = 0;
      if (nearby) nearby.visited = true;
      return;
    }

    if (!this.activeNpc) return;

    this.dialogueTimer += deltaSeconds;
    if (this.dialogueTimer >= NPC_LINE_DURATION_SECONDS && this.dialogueLineIndex < this.activeNpc.lines.length - 1) {
      this.dialogueLineIndex += 1;
      this.dialogueTimer = 0;
    }
  }
}
