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

- `src/game/Maze.ts` — the baked layout: a fixed 8×8 grid (adjacency stored as
  per-row bit-strings plus an ASCII-art comment for visual sanity-checking),
  derived `SPAWN_POINT`/`SPAWN_FORWARD`/`EXIT_POSITION`/`EXIT_DOOR_AXIS`, a
  per-cell ceiling-fixture position list, and `DAMAGED_FIXTURE_INDICES` (three
  permanently-flickering fixtures near early decoy branches — cosmetic only,
  not tied to any game state). Exports the shared `openingsOf(row, col)`
  helper so "which side of a cell is a real wall" is derived once and can't
  disagree between collision and render.
- `src/game/MazeGraph.ts` — everything derived from `Maze.ts` at module load:
  per-cell collision rects (`isPositionLegal`), `cellOf(position)`, a
  BFS-distance-from-exit table (`bfsDistanceFromExit`, `SPAWN_BFS_DISTANCE`).
  Replaces the old corridor's linear `playerZ / corridorLength` progress with
  a graph-topology one, since a maze's straight-line distance to the exit can
  cut through walls a real path can't.
- `src/game/GameRules.ts` — pure functions, no Three.js or DOM:
  `isIllegalMovement`, `applyDarknessPenalty`, `checkGhostCaught`,
  `checkExitReached`. This is what `spec/rules.test.ts` exercises directly.
- `src/game/LightController.ts` — the on → warning → dark → on cycle, with
  durations drawn from the progress-keyed tier; the warning phase is a
  handful of deliberate ~2 Hz pulses, not rapid flicker, so it never crosses
  into strobe territory.
- `src/game/Ghost.ts` — a `distance` scalar plus `positionBehind`, which walks
  backward along `Game`'s breadcrumb trail of the player's actual world
  positions (not a straight centreline, now that the corridor is a maze) to
  find the point exactly `distance` units of *real path* behind the player —
  so turning around via the camera mechanism reveals where it actually is,
  never a ghost floating through a wall.
- `src/game/Player.ts` — candidate-move-then-axis-separated-slide collision
  against `MazeGraph`'s rects (try the full 2D step, then X-only, then
  Z-only, else don't move), replacing the old single-axis corridor clamp;
  keeps the turn-rate-limited facing described above unchanged.
- `src/game/Game.ts` — orchestrates the above against real input and a real
  clock; owns the darkness-elapsed bookkeeping, the breadcrumb trail (append
  on movement past a minimum spacing, prune from the old end past a max arc
  length), and a high-water-mark BFS progress metric that never eases back
  down after a wrong turn; exposes `illegalMovementNow` for one frame at a
  time so the render/audio layers can cue footsteps without re-deriving the
  rule.
- `src/render/SceneManager.ts` — per-cell maze geometry (one floor/ceiling box
  per open room footprint, one wall box per closed edge or grid boundary,
  built from the same `openingsOf` helper as the collision model), per-fixture
  lights driven by `LightController.intensity`, an exit light/door oriented
  by `EXIT_DOOR_AXIS`, and the follow camera. World "up" is always
  `(0, 1, 0)`, so no per-frame quaternion realignment is needed.
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
- The maze conversion's first draft of `Game.seedTrail()` pushed the trail's
  two seed points in the wrong order (`spawn` first, the far point behind it
  last). `Ghost.positionBehind` walks backward from the trail's *last* entry
  treating it as the player's current position — with the original order,
  asking for the ghost's exact seeded distance (20 units) returned spawn
  itself instead of the point 20 units behind it, a silent inversion no
  typecheck or existing test could catch, since nothing yet exercised
  `positionBehind` against a real trail. Caught by hand-tracing the walk
  algebraically against the plan's own verification requirement ("confirm the
  trail-prune math can't strand `positionBehind` short of the 20 units it
  needs"), fixed by swapping the push order, and re-confirmed with a temporary
  diagnostic exercising both the freshly-seeded trail and one built by
  simulating 300 frames of forward movement through the maze.

## Playtesting

Real playtest, first round, reported directly by the person playing it:

- **Too easy — a straight corridor, holding the move key down the whole way
  reached the exit, and the light cycle was never really experienced.** Also
  flagged: the lights should go out at unpredictable times.

Root cause, traced by hand rather than assumed: at `CORRIDOR_LENGTH = 70` and
`PLAYER_SPEED = 4.2`, a full run takes about 16–17 seconds — short enough that
a player who never stops moving crosses the whole corridor within roughly one
light cycle plus a partial second one. The one dark period they pass through
costs at most ~13 units against a 17-unit margin, leaving several units to
spare, and the run typically finishes during the following on/warning phase
before a second dark period can add more risk. The randomised duration
(`pickDuration`) was already there — the level was simply too short for more
than one or two cycles to occur, so the variation was never visible.

Fixed by lengthening `CORRIDOR_LENGTH` to 150 (`src/game/Constants.ts`),
leaving speed and cycle timings alone. Re-traced by hand at the new length: a
player who never stops for darkness now runs out of margin partway through
the *second* dark period (roughly the corridor's midpoint) rather than
reaching the exit, while a player who stops moving during dark and continues
through on/warning finishes in around 50 seconds and passes through several
full cycles along the way — enough for the randomised timing to actually read
as unpredictable. Verified with `pnpm check` (29/29 green).

Real playtest, second round, reported directly by the person playing it —
this rejected the length fix above outright rather than confirming it:

> 你不要搞一个直路啊 搞个迷宫
> ("don't make it a straight path — make it a maze")

Lengthening a straight corridor was the wrong kind of fix: it changed *how
long* the mistake-free path was, not *whether wrong turns exist at all*, so
"hold the move key down" was still always the right strategy, just for
longer. Rather than guess at what "a maze" should mean, the scope was put to
the player directly via `AskUserQuestion`; they chose a **true branching maze
with real dead ends and genuine wrong-turn risk, using a fixed/baked layout**
(not regenerated per playthrough, so the layout can be hand-audited and
reasoned about once rather than trusted to a generator on every run).

Replaced the straight corridor with an 8×8 grid maze, generated once by a
one-off, never-shipped script (`scripts/generate-maze.ts`) and baked into
`src/game/Maze.ts`: a seeded recursive-backtracker produces a perfect maze
(spanning tree, 63 open edges, zero cycles, so every dead end is genuine —
there are no loops to accidentally wander back out of), with spawn and exit
placed at the tree's diameter endpoints (successful run:
`seed=1372 attempts=36 pathLength=38 leaves=10 spawn=[1,7] exit=[0,0]`).
Diameter endpoints are always degree-1, which is what lets `SPAWN_FORWARD`
and the exit door's orientation both derive from "the direction of that
cell's one opening" instead of being hardcoded to an axis.

This forced real architectural changes rather than a tuning pass: collision
went from a single-axis clamp against two side walls to per-cell rects (open
sides extend to the shared midpoint with the neighbouring cell, closed sides
stop `PLAYER_COLLISION_RADIUS` short of the wall) checked via
axis-separated slide movement so corners don't stop the player dead; the
progress metric went from linear `playerZ / corridorLength` to a BFS
graph-distance high-water mark (`MazeGraph.bfsDistanceFromExit`, never
regressing on a backtrack, so wandering into a dead end and returning can't
soften the difficulty tier back down); and the ghost's rendered position went
from "fixed distance behind the player along the corridor's centreline" to
walking backward along a pruned breadcrumb trail of the player's actual
world positions, so it always sits on ground the player genuinely walked
through the maze rather than cutting through a wall on a turn. The one rule
`spec/rules.test.ts` exercises directly (`applyDarknessPenalty`,
`checkGhostCaught`) is untouched; only `checkExitReached`'s signature moved
from a corridor-Z comparison to a precomputed Euclidean distance, updated in
that test file accordingly.

**Fairness trace, maze version.** The true (only, since it's a spanning
tree) spawn-to-exit path is 38 edges — longer than the pre-generation
estimate this was originally planned around (24–28), corrected here rather
than left stale — i.e. `SPAWN_BFS_DISTANCE = 38`. At `MAZE_CELL_SIZE = 6.5`
and `PLAYER_SPEED = 4.2`, a mistake-free run covers `38 × 6.5 = 247` units of
travel, roughly 59 seconds if never slowed by a turn — comparable to the
150-length corridor's ~50s target, and long enough to span several full
light cycles across the early/mid/late tiers rather than one or two. The
maze adds a risk layer the straight corridor never had: taking a wrong turn
while lit costs no `ghostDistance` directly (`isIllegalMovement` only
triggers in `dark`), but it adds real distance and time, which raises
exposure to more dark cycles before reaching the exit — a wrong turn is
punished by *more chances to fail the real rule*, not by a separate penalty.
10 of the maze's 64 cells are dead-end leaves (fewer than the
pre-generation ~12–16 estimate, also corrected here); three of them, near
early junctions where a wrong turn is cheapest to recover from, carry the
always-flickering `DAMAGED_FIXTURE_INDICES` cosmetic as a sightline cue.

Explicitly not fabricated, same as the corridor's own first playtesting
entry above: whether the maze reads as navigable without on-screen
instructions, whether the decoy branches land as intended, whether real
playtime lands near the ~59s estimate, and how cornering feels with the
turn-rate-limited camera *and* the new axis-separated slide collision. What
was verified instead — computationally, not assumed — before writing this
entry: `SPAWN_BFS_DISTANCE` (38) matches the generator's own reported
`pathLength`; `SPAWN_FORWARD`/`EXIT_DOOR_AXIS` point along each endpoint's
one real opening; a room centre, a passage midpoint, and a room's inner
corner (offset `PLAYER_COLLISION_RADIUS` from its wall stop) are all legal
positions, while a point just past a closed edge's wall stop is not; and
`Ghost.positionBehind` against a freshly-seeded and then a walked trail
returns a point exactly `ghost.distance` behind the player, never at or past
it. `pnpm check` is green (29/29). Stopping here for a real human playtest
pass before writing anything further in this section.
