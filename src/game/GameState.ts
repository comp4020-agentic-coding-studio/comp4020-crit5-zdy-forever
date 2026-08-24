export type Phase = "start" | "playing" | "won" | "lost";

export type GameEvent =
  | { readonly type: "start" }
  | { readonly type: "ghostCaught" }
  | { readonly type: "exitReached" }
  | { readonly type: "restart" };

// The only mutation any part of the game may perform on the phase: every
// transition is named here, so "what can turn PLAYING into LOST" always has
// exactly one place to look.
export function transition(phase: Phase, event: GameEvent): Phase {
  switch (event.type) {
    case "start":
      return phase === "start" ? "playing" : phase;
    case "ghostCaught":
      return phase === "playing" ? "lost" : phase;
    case "exitReached":
      return phase === "playing" ? "won" : phase;
    case "restart":
      return "playing";
  }
}
