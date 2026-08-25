// Every tunable number for DON'T MOVE, in one place, so balance changes
// during playtesting don't require hunting through the game/render code.

export const PLAYER_HEIGHT = 0.9;
export const PLAYER_SPEED = 4.2;
// How fast the player's facing -- and therefore the chase camera anchored
// behind it -- turns to catch up with the actual movement direction, in
// radians/second. Deliberately far slower than "instant": position always
// moves exactly where input says (camera-relative), but facing only slews
// toward that direction over time, so backing away (or strafing) turns the
// player -- and the camera -- around to look back rather than snapping.
// Carried over unchanged from LAST SIGNAL's playtest fix.
export const PLAYER_TURN_RATE_RADIANS_PER_SECOND = Math.PI;

export const CORRIDOR_HEIGHT = 3.4;
export const EXIT_TRIGGER_RADIUS = 2.5;

// The baked maze grid (src/game/Maze.ts) -- see PROCESS.md's fairness trace
// for why a straight corridor let a blind "just hold W" run finish before
// the light cycle ever mattered, and why a real branching maze fixes that.
// Cell pitch (centre-to-centre); half-width narrower than the old straight
// corridor's 2.2 on purpose, so corners genuinely require steering rather
// than reading as a wide hallway.
export const MAZE_CELL_SIZE = 6.5;
export const MAZE_CORRIDOR_HALF_WIDTH = 1.9;
export const PLAYER_COLLISION_RADIUS = 0.35;

// Breadcrumb-trail bounds for Ghost.positionBehind -- see Ghost.ts. The cap
// only needs headroom over GHOST_INITIAL_DISTANCE (below), since distance
// only ever shrinks except on reset().
export const GHOST_TRAIL_MIN_SPACING = 0.15;
export const GHOST_TRAIL_MAX_ARC_LENGTH = 30;

// Light-cycle durations by difficulty tier -- see LightController.ts. Ranges
// tighten (shorter LIGHT/WARNING, longer DARK) as the player advances, keyed
// to DIFFICULTY_MID_PROGRESS/DIFFICULTY_LATE_PROGRESS below.
export const LIGHT_ON_SECONDS_EARLY: readonly [number, number] = [6, 8];
export const LIGHT_ON_SECONDS_MID: readonly [number, number] = [4, 6];
export const LIGHT_ON_SECONDS_LATE: readonly [number, number] = [2.5, 4];
export const WARNING_SECONDS_EARLY: readonly [number, number] = [1.3, 1.6];
export const WARNING_SECONDS_MID: readonly [number, number] = [1, 1.3];
export const WARNING_SECONDS_LATE: readonly [number, number] = [0.7, 1];
export const DARK_SECONDS_EARLY: readonly [number, number] = [1.6, 2.2];
export const DARK_SECONDS_MID: readonly [number, number] = [2.2, 3];
export const DARK_SECONDS_LATE: readonly [number, number] = [2.8, 3.6];

// Progress fraction (BFS steps to the exit, see MazeGraph.ts) at which the
// mid/late timing tiers take over -- graph-distance-based, not wall-clock, so
// pacing tracks the player's own progress through the maze rather than
// racing an independent clock.
export const DIFFICULTY_MID_PROGRESS = 0.4;
export const DIFFICULTY_LATE_PROGRESS = 0.75;

// A move only counts as illegal once the lights have been out for longer
// than this -- the reaction-grace window the brief asks for, so the instant
// the lights cut isn't itself a punishable mistake.
export const REACTION_GRACE_PERIOD_SECONDS = 0.2;
// Movement input magnitude (0..1) above which standing "mostly still" no
// longer counts as safe.
export const MOVEMENT_THRESHOLD = 0.12;

export const GHOST_INITIAL_DISTANCE = 20;
export const GHOST_LOSS_THRESHOLD = 3;
// Units of ghostDistance consumed per second of illegal movement at full
// input magnitude -- tuned so one short, panicked dash in the dark costs a
// few units, not the whole margin (see PROCESS.md's fairness trace).
export const GHOST_PENALTY_PER_SECOND = 5.5;

// The final dramatic sequence: once this close to the exit, the ordinary
// cycle is overridden by one longer, forced dark period before the exit
// becomes visible again.
export const FINAL_STRETCH_DISTANCE_FROM_EXIT = 8;
export const FINAL_DARK_SECONDS = 3.5;

export const JOYSTICK_DEAD_ZONE = 0.12;

export const CAMERA_DISTANCE = 5.5;
export const CAMERA_HEIGHT = 2.4;
export const CAMERA_LOOK_HEIGHT = 1.2;

// Vertical FOV tuned for landscape/desktop. A portrait phone (aspect < 1)
// applying this unchanged gets a much narrower *horizontal* view -- so
// SceneManager widens it as aspect drops below CAMERA_FOV_REFERENCE_ASPECT,
// to keep roughly the same horizontal field of view, clamped so it never
// turns into a fisheye.
export const CAMERA_FOV_DEGREES = 55;
export const CAMERA_FOV_REFERENCE_ASPECT = 16 / 9;
export const CAMERA_FOV_MAX_DEGREES = 84;

// Held after a win/loss transition before the end screen actually appears,
// so the moment itself is visible for a beat rather than instantly covered.
export const END_SCREEN_DELAY_SECONDS = 1.6;
