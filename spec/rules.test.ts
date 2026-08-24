import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  checkGhostCollision,
  checkRocketReached,
  transition,
} from "../src/game/GameState.ts";

// Pure game rules -- no rendering, no DOM, no jsdom. This is the crit spec's
// "one rule of the game has a focused automated test" line.
describe("ghost collision ends the game", () => {
  const collisionRadius = 1.1;

  it("given the player is within the collision radius, the game is lost", () => {
    const player = new Vector3(0, 0, 0);
    const ghost = new Vector3(0.5, 0, 0);
    expect(checkGhostCollision(player, ghost, collisionRadius)).toBe(true);
    expect(transition("playing", { type: "ghostCollision" })).toBe("lost");
  });

  it("given the player is just outside the collision radius, the game continues", () => {
    const player = new Vector3(0, 0, 0);
    const ghost = new Vector3(1.2, 0, 0);
    expect(checkGhostCollision(player, ghost, collisionRadius)).toBe(false);
  });

  it("a collision only ends the game while it's actually being played", () => {
    expect(transition("won", { type: "ghostCollision" })).toBe("won");
    expect(transition("lost", { type: "ghostCollision" })).toBe("lost");
  });
});

describe("reaching the rocket wins the game", () => {
  const triggerRadius = 3;

  it("given the player is within the trigger radius, the game is won", () => {
    const player = new Vector3(10, 0, 0);
    const rocket = new Vector3(11, 0, 0);
    expect(checkRocketReached(player, rocket, triggerRadius)).toBe(true);
    expect(transition("playing", { type: "rocketReached" })).toBe("won");
  });

  it("given the player is outside the trigger radius, the game continues", () => {
    const player = new Vector3(10, 0, 0);
    const rocket = new Vector3(15, 0, 0);
    expect(checkRocketReached(player, rocket, triggerRadius)).toBe(false);
  });
});
