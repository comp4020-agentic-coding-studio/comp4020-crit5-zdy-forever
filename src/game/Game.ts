import { Vector3 } from "three";
import { GHOST_COLLISION_RADIUS, NPC_INTERACTION_RADIUS, NPC_LINE_DURATION_SECONDS, END_SCREEN_DELAY_SECONDS } from "./Constants.ts";
import { Ghost } from "./Ghost.ts";
import { checkGhostCollision, transition, type Phase } from "./GameState.ts";
import { NPC } from "./NPC.ts";
import { Player } from "./Player.ts";
import { NPCS, SPAWN_FORWARD, SPAWN_POINT } from "./World.ts";

export interface Movement {
  readonly x: number;
  readonly y: number;
}

// Orchestrates the pure rules (GameState) and the entities (Player, NPCs,
// Ghost, and later Rocket) against real input and a real clock. Nothing in
// here imports Three.js -- the render layer reads positions back out of it.
export class Game {
  phase: Phase = "start";
  readonly player: Player;
  readonly npcs: readonly NPC[];
  readonly ghost: Ghost;

  private activeNpc: NPC | null = null;
  private dialogueLineIndex = 0;
  private dialogueTimer = 0;
  private endScreenTimer = 0;
  private readonly moveDirection = new Vector3();

  constructor() {
    this.player = new Player(SPAWN_POINT, SPAWN_FORWARD);
    this.npcs = NPCS.map((definition) => new NPC(definition));
    this.ghost = new Ghost();
  }

  // null when no NPC is in range; otherwise the line currently being shown.
  // Lines advance on a timer -- there's no input to advance them manually.
  get dialogueText(): string | null {
    return this.activeNpc ? this.activeNpc.lines[this.dialogueLineIndex] : null;
  }

  // null until a win/loss has landed AND its short reveal delay has passed.
  get endScreenText(): string | null {
    if (this.phase === "lost" && this.endScreenTimer <= 0) return "FOUND";
    return null;
  }

  begin(): void {
    this.phase = transition(this.phase, { type: "start" });
  }

  reset(): void {
    this.player.position.copy(SPAWN_POINT);
    this.player.forward.copy(SPAWN_FORWARD).normalize();
    this.ghost.reset();
    for (const npc of this.npcs) npc.visited = false;
    this.activeNpc = null;
    this.dialogueLineIndex = 0;
    this.dialogueTimer = 0;
    this.endScreenTimer = 0;
    this.phase = transition(this.phase, { type: "restart" });
  }

  update(movement: Movement, groundForward: Vector3, groundRight: Vector3, deltaSeconds: number): void {
    if (this.phase !== "playing") {
      this.endScreenTimer = Math.max(0, this.endScreenTimer - deltaSeconds);
      return;
    }

    this.moveDirection.copy(groundRight).multiplyScalar(movement.x).addScaledVector(groundForward, movement.y);
    this.player.move(this.moveDirection, deltaSeconds);

    this.updateDialogue(deltaSeconds);

    if (this.npcs[0].visited) this.ghost.activate();
    this.ghost.update(this.player.position, deltaSeconds);

    if (checkGhostCollision(this.player.position, this.ghost.position, GHOST_COLLISION_RADIUS)) {
      this.phase = transition(this.phase, { type: "ghostCollision" });
      this.endScreenTimer = END_SCREEN_DELAY_SECONDS;
    }
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
