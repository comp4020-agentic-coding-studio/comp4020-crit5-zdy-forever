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
  pointer lock. Later switched from third-person (chase camera behind the
  player) to first-person on request — the mechanic itself needed no change
  to make that switch: the camera already faced exactly along `forward`, so
  moving it to the player's own eye position and dropping the third-person
  distance/offset preserved the same "backing away reveals the ghost" effect
  from inside the character's head instead of behind it. No mouse-look or
  touch-drag was added; there still isn't a separate look control.
- **Penalised, not blocked.** The brief describes moving in the dark as a
  temptation the player can give in to, not an input that stops working.
  Movement always goes exactly where input says; a separate rule
  (`GameRules.accumulateDarknessSeconds`) adds to a hidden cumulative
  darkness-action-seconds counter when the light is out, past a short
  reaction grace period, if the movement input is above a small threshold.
  This is also what makes "moving during darkness accumulates seconds toward
  death" an actual testable claim rather than a tautology about disabled
  input.
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
  `isIllegalMovement`, `accumulateDarknessSeconds`, `checkDarknessDeath`,
  `checkExitReached`. This is what `spec/rules.test.ts` exercises directly.
- `src/game/LightController.ts` — the on → warning → dark → on cycle, with
  durations drawn from the progress-keyed tier; the warning phase picks one
  of four flicker patterns at random each time it's entered (a steady
  alternation, a smooth breathing pulse, a slower/deeper alternation, and a
  decaying "dying bulb" wobble), all built to the same accessibility floor —
  no state change faster than ~0.25–0.35s, so none of them cross into
  rapid-strobe territory.
- `src/game/Player.ts` — candidate-move-then-axis-separated-slide collision
  against `MazeGraph`'s rects (try the full 2D step, then X-only, then
  Z-only, else don't move), replacing the old single-axis corridor clamp;
  keeps the turn-rate-limited facing described above unchanged.
- `src/game/Game.ts` — orchestrates the above against real input and a real
  clock; owns the darkness-elapsed bookkeeping, a cumulative
  darkness-action-seconds counter that only `reset()` clears (see the dated
  entry below for why it's whole-run cumulative rather than per-blackout), a
  `visitedCells` set feeding the minimap's fog-of-war, and a high-water-mark
  BFS progress metric that never eases back down after a wrong turn; exposes
  `illegalMovementNow` for one frame at a time so the render/audio layers can
  cue footsteps without re-deriving the rule.
- `src/render/SceneManager.ts` — per-cell maze geometry (one floor/ceiling box
  per open room footprint, one wall box per closed edge or grid boundary,
  built from the same `openingsOf` helper as the collision model), per-fixture
  lights driven by `LightController.intensity`, an exit light/door oriented
  by `EXIT_DOOR_AXIS`, and a first-person camera pinned to the player's eye
  position (`CAMERA_EYE_HEIGHT`) looking exactly along `forward` -- no
  position lag, since `forward` itself already eases toward the movement
  direction at a capped turn rate. There is no player body mesh and, since
  the dated entry below, no pursuer mesh either; the camera sits where it
  would have been. World "up" is always `(0, 1, 0)`, so no per-frame
  quaternion realignment is needed.
- `src/ui/Minimap.ts` — a fixed-orientation Canvas2D minimap in the top-left
  corner, drawn from `Game.visitedCells` and `Maze.openingsOf` so only cells
  the player has actually stood in are shown, with wall-line borders on their
  closed sides; only the player's facing tick rotates, never the map itself.
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

**Maze shrunk 8x8 -> 5x5 for a faster playtest loop.** The 38-edge, ~59s
true path above was slowing down iteration on unrelated changes — every
manual playtest paid nearly a minute just to reach the exit. Re-ran
`scripts/generate-maze.ts` with `ROWS=COLS=5` and a target path band of
16-19 edges (sampled 3000 seeds of a plain 5x5 recursive-backtracker first:
diameters cluster 16-22, so the band sits in the achievable middle, not the
tail), landing on seed 1519: 18 edges, ~117 units, ~28s ideal at
`PLAYER_SPEED=4.2` — comfortably inside a 40s playtest budget with room for
real turning and a wrong turn or two. 5 dead-end leaves survive (`MIN_LEAVES`
dropped to 5 to match the smaller tree), three of them tied for closest to
spawn by BFS distance ([1,2], [2,3], [3,2], all 5 steps out) and reassigned
to `DAMAGED_FIXTURE_INDICES`. Nothing outside `src/game/Maze.ts` and
`scripts/generate-maze.ts` hardcoded the old 8x8 size or edge count —
`MazeGraph.ts`, `SceneManager.ts`, and every spec test derive from
`MAZE_ROWS`/`MAZE_COLS`/`SPAWN_CELL`/`EXIT_CELL`, so `pnpm check` stayed
green (29/29) with no other file touched. Verified live: dev server up,
game started, held `W` from spawn, corridor and room geometry rendered with
no console/page errors.

**Closed walls didn't cover the rooms they were closing off.** Reported as a
dark pillar/window-shaped obstruction that looked passable but wasn't --
first seen near the exit and misdiagnosed as the exit door mesh (removed
per request, since walls were meant to be solid with no door frame at all),
then seen again next to spawn where no door mesh had ever existed, which
ruled that diagnosis out. Root cause was in `SceneManager.buildWall()`:
every closed edge got a wall sized to the fixed corridor width
(`MAZE_CORRIDOR_HALF_WIDTH * 2`), but `buildMazeRoom()` extends a room's own
footprint out to the full cell pitch (`HALF_PITCH`) on any side that's
*open* -- so a room widened by a perpendicular opening (any turn,
T-junction, or crossing) left its closing wall too narrow on one or both
flanks. The gap wasn't a hole in the collision grid (that's built from
`openingsOf()` independently and was already correct) -- just floor with no
wall standing on it, letting the next room's light bleed through and
reading as an opening you could walk into, when the true edge was still
closed. Fixed by sizing each wall from `openingsOf()` on both cells it
borders (the union of their widths on that side) instead of assuming every
closed edge is the same width. Verified with headless-browser renders of
the T-junction two cells from spawn before and after: solid on both flanks
afterwards, open only on the one side `openingsOf` actually reports as
open. Only `SceneManager.ts` changed -- collision needed no fix since it was
never wrong -- and `pnpm check` stayed green (29/29).

**Maze shrunk again, 5x5 -> 4x4.** Asked for a smaller maze on top of the
above. Re-ran `scripts/generate-maze.ts` with `ROWS=COLS=4` and a target path
band of 11-13 edges (sampled 3000 seeds of a plain 4x4 recursive-backtracker
first: diameters cluster 10-15, 15 being the theoretical max for 16 cells),
landing on seed 265: 12 edges, ~78 units, ~19s ideal at `PLAYER_SPEED=4.2` --
generous headroom inside the 40s budget. `MIN_LEAVES` dropped to 3 (a 12-edge
path through 16 cells only leaves 4 cells off the true path, so 5 dead ends
the way 5x5 had was never going to fit). 3 dead-end leaves survive; the two
closest to spawn by BFS distance ([0,3] at 3 steps, [2,2] at 4 steps) are
reassigned to `DAMAGED_FIXTURE_INDICES`, while the third (9 steps out) is left
alone same as the two far dead ends were in the 5x5 layout. Same
parametrization as last time meant only `src/game/Maze.ts` and
`scripts/generate-maze.ts` needed touching; `pnpm check` stayed green
(29/29). Verified live via a headless render from the new spawn cell and its
T-junction neighbour, matching the new layout's bitstrings with no wall
gaps.

**Internal walls floated clear of the floor on both flanks.** Reported
during a playtest as clipping/gap-through-geometry at two corridors, distinct
from the earlier "closed walls didn't cover the rooms" bug -- that one fixed
each wall's span along its *long* axis; this one is a gap along its *short*
axis, invisible to the same T-junction screenshot check used last time.
`buildMazeRoom()` stopped a room's floor/ceiling at `MAZE_CORRIDOR_HALF_WIDTH`
(1.9) on *every* closed side, but that's only where a *boundary* wall (the
outer edge of the grid) actually sits -- an *internal* wall between two real
cells sits at the cell-pitch midpoint (`HALF_PITCH`, 3.25) instead, so every
one of the maze's 9 internal closed edges left a floor stopping roughly 1.25
units short of the wall standing on nothing beyond it, on both bordering
rooms. Screenshots couldn't confirm this directly -- the horror lighting
(`FogExp2` density 0.035, background `0x040406`) renders any unlit corridor
near-black regardless of geometry, so a temporary Vitest script
(`scripts/_tmp-wall-audit.test.ts`, deleted after use, never committed)
replicated `buildMazeRoom`'s and `buildWall`'s exact math from the real
exported `Maze.ts`/`Constants.ts` functions and reported every wall's gap to
the floor it should border. Before the fix: all 9 internal walls, 0
boundary walls. Fixed by having `buildMazeRoom()` check, per side, whether
`row`/`col` puts it at the grid's outer boundary (keep
`MAZE_CORRIDOR_HALF_WIDTH`) or an internal edge (extend to
`HALF_PITCH - WALL_THICKNESS / 2`, the wall's own near face) -- re-running the
same audit script confirmed every internal wall now sits exactly flush
against both bordering floors, zero gap and zero overlap. Collision needed no
fix, same as last time (`MazeGraph.ts`'s rects are independent of wall mesh
position). Only `SceneManager.ts` changed; `pnpm check` stayed green
(29/29).

**Pursuer removed; death switched from distance to cumulative darkness-action
time; warning-light flicker randomised; a fog-of-war minimap added.** Direct
request:

> 被鬼抓到到found改成DIE 然后去掉鬼的建模 判定die改成在黑暗中行动多少秒
> 然后灯光多做几组动效每次随机选择 左上角开一个小地图 固定不旋转 然后可以
> 看到自己已开发的区域
> ("change the caught-by-the-ghost 'FOUND' text to 'DIE'; remove the ghost's
> model; change the death judgment to how many seconds you've moved in the
> dark; add several more light animation variants, one picked at random each
> time; open a minimap in the top-left, fixed and non-rotating, showing the
> area you've already explored")

One open design question: whether the darkness-action counter should
accumulate across the whole run or reset every dark cycle. Put to the player
directly via `AskUserQuestion` rather than assumed; they chose whole-run
cumulative, so several short lapses across separate blackouts now add up
toward the same death threshold instead of each getting a clean slate.

Removing the ghost as a rendered, positioned entity made its whole supporting
apparatus dead code, not just the mesh: `Ghost.ts` (the `distance` scalar and
`positionBehind`) and `Game`'s breadcrumb `trail` (which existed solely to
give the ghost mesh a real path to walk backward along) both existed to
answer "where does the pursuer's body sit", a question that no longer has
meaning once there's no body — both deleted outright rather than patched
around. `GameRules.applyDarknessPenalty`/`checkGhostCaught` were renamed to
`accumulateDarknessSeconds`/`checkDarknessDeath` and re-derived from a
decrementing distance budget to a monotonically-increasing seconds counter
against `DARKNESS_DEATH_SECONDS` (3, kept at roughly the old budget's order of
magnitude — see the corridor-era fairness trace above for where that budget
came from); `GameState`'s `ghostCaught` event became `diedInDarkness`. The old
ghost-proximity `danger` formula in `main.ts` (`clamp((ghostDistance -
threshold) / (initial - threshold), ...)`) moved into `Game.danger`
(`darknessActionSeconds / DARKNESS_DEATH_SECONDS`, clamped to 1), still
driving the same vignette/camera-dread/audio cues as before.

The warning-light flicker went from one fixed ~2 Hz alternation to a
4-pattern array (`LightController.WARNING_PATTERNS`) sampled with
`Math.random()` every time the light re-enters `"warning"`: the original
steady alternation, a slower/deeper alternation, a continuous sine "breathing"
pulse with no hard cuts, and a decaying wobble that reads as the bulb actually
failing. Every pattern was written to keep the same ≥0.25–0.35s
state-change floor the original relied on to stay clear of strobe thresholds,
rather than letting the random choice introduce a faster one by accident.

The minimap (`src/ui/Minimap.ts`) reveals only `Game.visitedCells` — grid
cells the player has actually stood in, keyed off the same `cellOf()` call
`Game.update()` already made for BFS progress tracking, so tracking it cost
one `Set.add()` and no new per-frame computation. Its canvas is hand-authored
in `index.html` rather than created at runtime, per this repo's own
`CLAUDE.md` note that a build-time-only tool like Vite never executes
runtime JS, so a jsdom-based spec test parsing `dist/index.html` would never
see a script-created element. Wall-line borders reuse `Maze.openingsOf()`
rather than re-deriving which sides are walls, so the minimap and the
collision model can't disagree about where an opening is. The map's own
orientation never changes; only a short facing tick drawn from
`player.forward` rotates around the player's dot.

Verified: `pnpm check` green (29/29, including the rewritten
`spec/rules.test.ts` against the renamed rule functions and event). Manually
in the dev server: losing shows `DIE` with no ghost geometry anywhere in the
scene; deliberately dashing through several dark periods dies only once the
cumulative total clears the threshold, not on the first short dash and not
never; the vignette/heartbeat still ramp smoothly with `Game.danger`; several
consecutive warning phases visibly used different flicker patterns with none
reading as rapid strobing; the top-left minimap grew to cover only cells
actually walked, stayed fixed while turning in place, and only its facing
tick rotated.

**Secret door easter egg behind spawn.** Direct request:

> 然后加一个小彩蛋 出生点转身180 再向前走也会出现一个门 走过去就通关了
> ("also add a small easter egg: at spawn, turn around 180 degrees, walk
> forward, and there's a door there too — walking through it wins the game")

Spawn (`SPAWN_CELL`) is a degree-1 node in the maze's spanning tree, so three
of its four sides are legitimately closed and only one — the real path —
is open. The cell directly behind it (`SPAWN_CELL[0]+1, SPAWN_CELL[1]`,
already a real, connected maze cell reachable the normal way from elsewhere)
sits behind the closed edge a 180° turn faces. Rather than touch
`isVerticalOpen`/`isHorizontalOpen`/`neighboursOf` — which would corrupt
every property computed from them elsewhere in this file (spanning-tree/
no-cycles, `SPAWN_BFS_DISTANCE`, dead-end counts, `bfsDistanceFromExit`
tiering) — the shortcut was added as three independent, additive
special-cases that never touch the real graph functions:
`MazeGraph.ts` gets one extra `Rect` appended to `COLLISION_RECTS`, built
directly from `SPAWN_POINT`/`SECRET_DOOR_POSITION` rather than derived from
`openingsOf()`; `SceneManager.buildMaze()`'s vertical-wall loop special-cases
exactly that one edge to skip building a wall there, patched with one small
bridging floor/ceiling pair (`buildSecretDoor`) sized the same way the real
per-cell rooms already are; and `Game.update()` adds a second
`checkExitReached` distance check against `SECRET_DOOR_POSITION`, reusing the
same trigger radius, transition, and `"ESCAPED"` end text as the real exit.
`openingsOf`/`neighboursOf` themselves are unmodified, so every value derived
from them is provably unchanged.

Verified end-to-end, not just by type/build: a headless Playwright session
against the real dev server drove `KeyS` (backward, i.e. toward the door from
spawn) and confirmed `phase` reached `"won"`; a second run confirmed the
`ESCAPED` end screen actually renders. Screenshotting the corridor itself
surfaced a real issue the type/build/test checks couldn't catch: the new
`doorLight` (`PointLight(0x9a7ee0, 3, 10, 2)`) was essentially invisible next
to the full-intensity warm ceiling fixture sharing its cell — unlike the
real exit's glow, which is only ever seen once the light cycle has darkened
toward the end of a run, this doorway sits right at spawn, where the cycle
has had zero progress to work with and is always at full "on" brightness.
Diagnosed live by exposing a temporary debug hook (position/forward teleport,
scene point-light introspection, reverted before commit, no trace left in
`main.ts`) that confirmed the light existed with the right position/color but
was simply outmatched; retuned by trial screenshots at several
intensity/distance pairs until the violet tint was clearly visible against
the same ceiling fixture, landing on `PointLight(0x9a7ee0, 10, 9, 2)`.
Verified with `pnpm check` (29/29 green) and a final headless screenshot pass
confirming the retuned light, the gapless floor/ceiling patch, and the
`ESCAPED` end screen all render correctly.
