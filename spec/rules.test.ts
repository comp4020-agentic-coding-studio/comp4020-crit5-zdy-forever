import { describe, expect, it } from "vitest";
import { applyDarknessPenalty, checkExitReached, checkGhostCaught, isIllegalMovement } from "../src/game/GameRules.ts";
import { transition } from "../src/game/GameState.ts";

// Pure game rules -- no rendering, no DOM, no jsdom. This is the crit spec's
// "one rule of the game has a focused automated test" line: moving while the
// lights are out is the one rule the whole game hangs off.
describe("moving during darkness brings the ghost closer", () => {
  it("given the lights are dark and the grace period has passed, moving decreases ghostDistance", () => {
    const next = applyDarknessPenalty(20, "dark", 1, 1, 1, 5);
    expect(next).toBeLessThan(20);
  });

  it("given the lights are dark, standing still leaves ghostDistance unchanged", () => {
    const next = applyDarknessPenalty(20, "dark", 0, 1, 1, 5);
    expect(next).toBe(20);
  });

  it("given the lights are on, moving never counts as illegal", () => {
    expect(isIllegalMovement("on", 1, 1)).toBe(false);
  });

  it("moving within the reaction grace period is not punished", () => {
    expect(isIllegalMovement("dark", 1, 0.05)).toBe(false);
    const next = applyDarknessPenalty(20, "dark", 1, 0.05, 1, 5);
    expect(next).toBe(20);
  });

  it("ghostDistance never drops below zero", () => {
    const next = applyDarknessPenalty(1, "dark", 1, 1, 1, 5);
    expect(next).toBe(0);
  });
});

describe("the ghost reaching the loss threshold ends the game", () => {
  const lossThreshold = 3;

  it("given ghostDistance is at or below the threshold, the game is lost", () => {
    expect(checkGhostCaught(2, lossThreshold)).toBe(true);
    expect(transition("playing", { type: "ghostCaught" })).toBe("lost");
  });

  it("given ghostDistance is above the threshold, the game continues", () => {
    expect(checkGhostCaught(5, lossThreshold)).toBe(false);
  });

  it("a catch only ends the game while it's actually being played", () => {
    expect(transition("won", { type: "ghostCaught" })).toBe("won");
    expect(transition("lost", { type: "ghostCaught" })).toBe("lost");
  });
});

describe("reaching the exit wins the game", () => {
  const triggerRadius = 2.5;

  it("given the player is within the trigger radius of the exit, the game is won", () => {
    expect(checkExitReached(68, 70, triggerRadius)).toBe(true);
    expect(transition("playing", { type: "exitReached" })).toBe("won");
  });

  it("given the player is outside the trigger radius, the game continues", () => {
    expect(checkExitReached(60, 70, triggerRadius)).toBe(false);
  });
});
