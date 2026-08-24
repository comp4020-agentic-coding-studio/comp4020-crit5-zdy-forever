# Process overview

## Direction

The prototype in this repo used to be **LAST SIGNAL**, a third-person horror
game on a small dark planet with three NPCs, dialogue, and a rocket escape.
That concept is gone by deliberate decision, not because it was broken — its
last playtest fix (a rate-limited turn instead of a snapping one,
[`9bb4d46`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-zdy-forever/commit/9bb4d46))
is still good work and its *mechanism* carries forward almost unchanged below.
After that fix landed, the direction was overturned outright rather than
extended: the new brief is **DON'T MOVE**, a single-mechanic corridor horror
game with no NPCs, no dialogue, no objectives UI, and no on/off-screen
instructions ever. Move freely while the light is on; moving while it's dark
lets a hidden pursuer close the distance behind you; two or three mistakes are
survivable, a fourth isn't; reach the lit exit and it's over the other way.

Inspecting the old repo before touching it split the work into three piles,
kept honest here rather than silently overwritten:

- **Reused as-is** — `src/input/KeyboardInput.ts`, `TouchJoystick.ts`,
  `InputManager.ts` (WASD/arrows + an analog touch joystick, already
  playtested), `src/ui/EndScreen.ts` (generic show/hide + restart), and the
  whole toolchain (`vite.config.ts`, `package.json`, `tsconfig.json`,
  `CLAUDE.md`, `scripts/check-evidence.ts`, `spec/invariants.test.ts`).
- **Pattern reused, content rewritten** — `SceneManager.ts` (follow-camera
  math kept, the *scene* it renders replaced), `AudioManager.ts` (procedural
  WebAudio architecture kept, the *sounds* replaced), `main.ts`, `Constants.ts`,
  `GameState.ts`, `index.html`/`styles.css`, `spec/rules.test.ts`.
- **Deleted** — `World.ts`, `NPC.ts`, `sphereMotion.ts`, `DialogueUI.ts`: all
  specific to the planet/NPC design, with nothing generic left to salvage.
  `public/card.png` was regenerated for the new concept.

## Grounding

The brief left several questions open on purpose. Each was resolved against
what was already proven to work, not by picking arbitrarily:

- **Camera.** Reusing the just-fixed follow camera (position turns instantly
  with input, `forward` turns toward it at a capped rate,
  `PLAYER_TURN_RATE_RADIANS_PER_SECOND`) answers the brief's "can the player
  look back at the ghost" question for free — backing away turns the camera
  around over about half a second, with no separate look control and no
  pointer lock.
- **Penalised, not blocked.** The brief describes moving in the dark as a
  temptation the player can give in to, not an input that stops working.
  Movement always goes exactly where input says; a separate rule
  (`GameRules.applyDarknessPenalty`) shrinks the hidden `ghostDistance` value
  when the light is out, past a short reaction grace period, if the movement
  input is above a small threshold. This is also what makes "moving during
  darkness brings the ghost closer" an actual testable claim rather than a
  tautology about disabled input.
- **A 4-phase machine, not 6.** The brief's own suggested state list was
  offered as an example. `start | playing | won | lost` (the same shape
  `GameState.ts` already used) is enough — the scripted win/loss sequence
  (frozen input, stinger, fade, end-screen word) is timing owned by `Game.ts`,
  not additional states to test.
- **Difficulty by distance, not by clock.** Light/warning/dark durations tier
  off `Game.progress` (`playerZ / corridorLength`), matching the brief's own
  distance-based final-stretch trigger and keeping the whole cycle a
  deterministic function of position instead of a race against wall-clock
  time.

## Architecture

- `src/game/Corridor.ts` — static layout: spawn point, exit position, the one
  wider chamber, ceiling-fixture spacing, and which fixture is the
  permanently-flickering "damaged" one (cosmetic only, not tied to any game
  state).
- `src/game/GameRules.ts` — pure functions, no Three.js or DOM:
  `isIllegalMovement`, `applyDarknessPenalty`, `checkGhostCaught`,
  `checkExitReached`. This is what `spec/rules.test.ts` exercises directly.
- `src/game/LightController.ts` — the on → warning → dark → on cycle, with
  durations drawn from the progress-keyed tier; the warning phase is a
  handful of deliberate ~2 Hz pulses, not rapid flicker, so it never crosses
  into strobe territory.
- `src/game/Ghost.ts` — a `distance` scalar and nothing else: no wander/chase
  state machine. It only ever shrinks via `GameRules`, and it renders fixed
  along the corridor's own centreline behind the player's current position —
  not behind the player's facing — so turning around via the camera mechanism
  actually reveals where it is instead of it "following" the view.
- `src/game/Player.ts` — flat-plane movement (no more great-circle sphere
  math, since the corridor floor is flat), keeping the turn-rate-limited
  facing described above.
- `src/game/Game.ts` — orchestrates the above against real input and a real
  clock; owns the darkness-elapsed bookkeeping directly and exposes
  `illegalMovementNow` for one frame at a time so the render/audio layers can
  cue footsteps without re-deriving the rule.
- `src/render/SceneManager.ts` — corridor geometry, per-fixture lights driven
  by `LightController.intensity`, an exit light independent of the cycle, and
  the follow camera. Simpler than the sphere version: world "up" is always
  `(0, 1, 0)` now, so the per-frame quaternion realignment the planet needed
  is gone.
- `src/audio/AudioManager.ts` — procedural WebAudio only, gated on the same
  start-button gesture as before: an always-on ambient hum, a heartbeat and a
  breathing layer that fade in as danger rises, footstep thumps cued by
  `illegalMovementNow`, and short synthesized stingers for the loss/win cuts.

## Verification

- `pnpm check` (typecheck, build, lint, stylelint, `spec/rules.test.ts` +
  `spec/game.test.ts` + `spec/invariants.test.ts`) green before anything is
  committed.
- Boundary cases this environment can't click through in a browser were
  traced by hand instead of assumed: a move made inside the reaction grace
  period does not shrink `ghostDistance`; a move made one tick after the grace
  period does; `ghostDistance` clamps at zero rather than going negative;
  `checkGhostCaught`/`checkExitReached` are exercised at, above, and below
  their thresholds in `spec/rules.test.ts` rather than only in the middle of
  the range.
- The warning-phase pulse rate (~2 Hz, alternating between two fixed
  intensities) was chosen to stay well clear of photosensitive-strobe
  thresholds, and `prefers-reduced-motion` is expected to gate camera
  shake/distortion rather than the light cycle itself, since the cycle is the
  one mechanic the whole game is built on.
- **Fairness trace.** The margin between `GHOST_INITIAL_DISTANCE` (20) and
  `GHOST_LOSS_THRESHOLD` (3) is 17 units; `GHOST_PENALTY_PER_SECOND` is 5.5 at
  full input magnitude. Treating one "mistake" as roughly a one-second lapse
  (moving at full speed for ~1s before stopping) costs 5.5 units, so a player
  who keeps making that same short mistake survives about three of them
  (17 / 5.5 ≈ 3.1) — inside the brief's "2–3 mistakes" target — regardless of
  tier. Treating a mistake as never stopping for an entire dark period instead
  gives a curve that gets harsher as the game progresses, which is intended:
  early tier's shortest dark span (1.6s, minus the 0.2s grace) costs
  1.0 × 5.5 × 1.4 ≈ 7.7 units (about 2.2 fully-ignored dark periods to lose),
  while late tier's longest dark span (3.6s, minus grace) costs
  1.0 × 5.5 × 3.4 ≈ 18.7 units — enough on its own to lose from full health,
  which is deliberate: by the late tier a single fully-ignored blackout should
  be fatal. The final forced blackout (3.5s) sits deliberately in that same
  late-tier range rather than being a separate, harsher spike.

## Corrections

- The literal plan called for committing the LAST-SIGNAL file deletions on
  their own before any new code landed. Doing that alone would have left five
  other files importing from files that no longer exist — a red `pnpm check`
  committed to history, which `CLAUDE.md`'s "never commit a red state" rule
  rules out. The deletions and their full replacements are one consolidated
  commit instead; later commits (difficulty tuning, responsive polish, the
  card/copy update, this document) are the genuinely incremental ones the
  plan originally asked every step to be.
- A first draft of `Corridor.ts` was written with placeholder/self-importing
  content by mistake and caught immediately, before any check ran, by
  rereading it against what the rest of the module actually needed.

## Playtesting

Not yet done. No result is recorded here because none has happened —
this section stays blank until a real person has actually played a full
round, same standard as LAST SIGNAL's playtest section before it.
