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

// Long enough that holding the move key down the whole way runs through
// several full light cycles, not just one -- see PROCESS.md's fairness trace
// for why 70 let a blind "just hold W" run finish before the mechanic ever
// mattered.
export const CORRIDOR_LENGTH = 150;
export const CORRIDOR_HALF_WIDTH = 2.2;
export const CORRIDOR_HEIGHT = 3.4;
export const CORRIDOR_SIDE_MARGIN = 0.3;
export const CORRIDOR_BACK_WALL_Z = 0.5;
export const EXIT_TRIGGER_RADIUS = 2.5;

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

// Progress fraction (playerZ / CORRIDOR_LENGTH) at which the mid/late timing
// tiers take over -- distance-based, not wall-clock, so pacing tracks the
// player's own pace rather than racing an independent clock.
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
