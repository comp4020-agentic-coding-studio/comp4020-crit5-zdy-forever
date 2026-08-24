import type { Vector3 } from "three";
import type { NpcDefinition } from "./World.ts";

// Thin wrapper around the static NpcDefinition data plus the one thing that
// changes at runtime: whether the player has come close enough to trigger it.
export class NPC {
  readonly id: string;
  readonly position: Vector3;
  readonly lines: readonly string[];
  visited = false;

  constructor(definition: NpcDefinition) {
    this.id = definition.id;
    this.position = definition.position;
    this.lines = definition.lines;
  }

  isInRange(playerPosition: Vector3, radius: number): boolean {
    return this.position.distanceTo(playerPosition) <= radius;
  }
}
