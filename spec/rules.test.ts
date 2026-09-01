import { describe, expect, it } from "vitest";
import { accumulateDarknessSeconds, checkDarknessDeath, checkExitReached, isIllegalMovement } from "../src/game/GameRules.ts";
import { transition } from "../src/game/GameState.ts";

// Pure game rules -- no rendering, no DOM, no jsdom. This is the crit spec's
// "one rule of the game has a focused automated test" line: moving while the
// lights are out is the one rule the whole game hangs off.
describe("moving during darkness accumulates seconds toward death", () => {
  it("given the lights are dark and the grace period has passed, moving accumulates seconds", () => {
    const next = accumulateDarknessSeconds(0, "dark", 1, 1, 1);
    expect(next).toBeGreaterThan(0);
  });

  it("given the lights are dark, standing still leaves the accumulated total unchanged", () => {
    const next = accumulateDarknessSeconds(0, "dark", 0, 1, 1);
    expect(next).toBe(0);
  });

  it("given the lights are on, moving never counts as illegal", () => {
    expect(isIllegalMovement("on", 1, 1)).toBe(false);
  });

  it("moving within the reaction grace period is not punished", () => {
    expect(isIllegalMovement("dark", 1, 0.05)).toBe(false);
    const next = accumulateDarknessSeconds(0, "dark", 1, 0.05, 1);
    expect(next).toBe(0);
  });

  it("accumulated seconds never reset except by a full game reset -- separate illegal moves add up", () => {
    const afterFirst = accumulateDarknessSeconds(0, "dark", 1, 1, 1);
    const afterSecond = accumulateDarknessSeconds(afterFirst, "dark", 1, 1, 1);
    expect(afterSecond).toBeGreaterThan(afterFirst);
  });
});

describe("accumulating enough darkness seconds ends the game", () => {
  const deathThreshold = 3;

  it("given the accumulated seconds are at or above the threshold, the game is lost", () => {
    expect(checkDarknessDeath(3, deathThreshold)).toBe(true);
    expect(transition("playing", { type: "diedInDarkness" })).toBe("lost");
  });

  it("given the accumulated seconds are below the threshold, the game continues", () => {
    expect(checkDarknessDeath(1, deathThreshold)).toBe(false);
  });

  it("a death event only ends the game while it's actually being played", () => {
    expect(transition("won", { type: "diedInDarkness" })).toBe("won");
    expect(transition("lost", { type: "diedInDarkness" })).toBe("lost");
  });
});

describe("reaching the exit wins the game", () => {
  const triggerRadius = 2.5;

  it("given the player is within the trigger radius of the exit, the game is won", () => {
    expect(checkExitReached(2, triggerRadius)).toBe(true);
    expect(transition("playing", { type: "exitReached" })).toBe("won");
  });

  it("given the player is outside the trigger radius, the game continues", () => {
    expect(checkExitReached(10, triggerRadius)).toBe(false);
  });
});
