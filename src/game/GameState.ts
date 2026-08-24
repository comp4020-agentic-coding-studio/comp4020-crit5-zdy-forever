import type { Vector3 } from "three";

export type Phase = "start" | "playing" | "won" | "lost";

export type GameEvent =
  | { readonly type: "start" }
  | { readonly type: "ghostCollision" }
  | { readonly type: "rocketReached" }
  | { readonly type: "restart" };

export function checkGhostCollision(
  playerPosition: Vector3,
  ghostPosition: Vector3,
  collisionRadius: number,
): boolean {
  return playerPosition.distanceTo(ghostPosition) <= collisionRadius;
}

export function checkRocketReached(
  playerPosition: Vector3,
  rocketPosition: Vector3,
  triggerRadius: number,
): boolean {
  return playerPosition.distanceTo(rocketPosition) <= triggerRadius;
}

// The only mutation any part of the game may perform on the phase: every
// transition is named here, so "what can turn PLAYING into LOST" always has
// exactly one place to look.
export function transition(phase: Phase, event: GameEvent): Phase {
  switch (event.type) {
    case "start":
      return phase === "start" ? "playing" : phase;
    case "ghostCollision":
      return phase === "playing" ? "lost" : phase;
    case "rocketReached":
      return phase === "playing" ? "won" : phase;
    case "restart":
      return "playing";
  }
}
