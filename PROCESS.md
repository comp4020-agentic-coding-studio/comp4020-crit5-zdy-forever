# Process overview

## What I built

**LAST SIGNAL** — a small third-person horror game on a tiny, dark spherical
planet. The player wakes with no on-screen or off-screen instructions, finds
three NPCs scattered across the sphere (proximity triggers short,
auto-advancing dialogue — nothing to press), avoids a hostile ghost that wakes
the first time an NPC is found, and follows environmental landmarks (a radio
tower, a damaged shelter, a chain of red beacons) to a rocket to escape. Ghost
contact ends the game; reaching the rocket wins it. Desktop uses
camera-relative WASD (silent arrow-key fallback); a touch device gets an
on-screen analog joystick instead — both funnel into one shared `{x, y}`
movement vector, so the player logic never knows which input produced it.

## The moments that mattered

1. **Vite doesn't execute JS at build time, so a jsdom spec test only sees
   hand-authored HTML.** `spec/game.test.ts` parses the *built*
   `dist/index.html` looking for a focusable start control; anything built by
   `main.ts`/`Game.ts` at runtime is invisible to that check. Instead of
   building the start overlay/canvas/dialogue/joystick/end-screen from
   TypeScript, I authored them directly in `index.html` as hidden-by-default
   markup that runtime code only ever toggles or populates. I confirmed this
   was actually necessary (not just cautious) by checking what
   `pnpm build` literally writes to `dist/index.html`, then recorded the
   constraint itself in `CLAUDE.md` so it doesn't have to be rediscovered next
   week, rather than just fixing this one file.
   [`0f399ff`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-zdy-forever/commit/0f399ff),
   harness note:
   [`b16c62b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-zdy-forever/commit/b16c62b)

2. **The ghost needed hysteresis, not a single distance threshold.** A single
   "detect within radius X" rule flips the ghost between wander and chase
   every frame while the player sits near the boundary — it would read as a
   bug, not tension. I gave it two radii instead: it starts chasing at 7 units
   but only gives up past 11, so the gap itself is what prevents the flicker.
   I checked this by reasoning through the boundary case by hand (a player
   holding still at distance 8 should never see the ghost flip state) rather
   than by eyeballing it, since this environment has no way to click through
   the actual gameplay.
   [`93951cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-zdy-forever/commit/93951cd)

3. **A fixed camera FOV reads a phone as far narrower than a desktop
   window.** Applying the same 55° vertical FOV straight to a 390×844
   portrait aspect (0.462) gives a much narrower horizontal field of view than
   the same code gives a 16:9 desktop window — worse visibility of exactly the
   thing (a ghost approaching from the side) the phone player most needs to
   see. Rather than picking a bigger number and hoping, I worked out the
   horizontal FOV a 16:9 window actually gets at 55° vertical, then solved for
   the vertical FOV that reproduces roughly that same horizontal FOV at the
   phone's aspect ratio (clamped so it can't turn into a fisheye) —
   `SceneManager.computeFov()`. I checked it by re-deriving both aspect
   ratios' numbers by hand before writing the code, the closest thing to
   verification available without a device lab or a browser tool in this
   session.
   [`ea3d381`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-zdy-forever/commit/ea3d381)

4. **The joystick's dead zone needed remapping, not just clamping.** A first
   pass at `TouchJoystick.ts` would have made the movement value jump straight
   from 0 to the dead zone's own magnitude the instant a finger cleared it,
   instead of ramping — a visible "snap to half speed" on any small
   deflection. I caught this while drafting, before it shipped, by separating
   the knob's *visual* offset from the *logical* movement value and remapping
   the latter so it's exactly 0 at the dead-zone edge and exactly 1 at full
   displacement. I checked the remap formula's two boundary values by hand
   before writing it, rather than writing the "obvious" version and noticing
   the jump later.
   [`de6971b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-zdy-forever/commit/de6971b)

## Playtesting

Not yet filled in. The build reached a genuinely playable end-to-end state
without a real human playtest — this environment has no browser-automation
tool, so every visual/experiential property above (movement feel, camera
framing, whether the horror actually lands, whether a stranger can finish in
2–5 minutes with zero instructions) has only been verified by code review and
`pnpm check`'s automated suite, never by actually playing it. This section
gets filled in with a real observation and the correction made in response
once that playtest happens — not before.
