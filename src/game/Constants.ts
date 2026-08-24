// Every tunable number for LAST SIGNAL, in one place, so balance changes
// during playtesting don't require hunting through the game/render code.

export const PLANET_RADIUS = 18;
export const PLAYER_HEIGHT = 0.9;
export const PLAYER_SPEED = 6.5;

export const GHOST_SPEED = 5.2; // ~80% of PLAYER_SPEED
export const GHOST_WANDER_SPEED_FACTOR = 0.4;
export const GHOST_DETECT_RADIUS = 7;
// Bigger than GHOST_DETECT_RADIUS on purpose -- the gap is hysteresis, so a
// player hovering right at the edge of detection doesn't flicker the ghost
// between wander and chase every frame.
export const GHOST_LOSE_RADIUS = 11;
export const GHOST_COLLISION_RADIUS = 1.1;

export const NPC_INTERACTION_RADIUS = 3.5;
// How long each line of an NPC's dialogue holds before advancing to the
// next -- there's no input to advance it manually, so this has to be
// readable at a glance rather than paced for a click.
export const NPC_LINE_DURATION_SECONDS = 3.2;
export const ROCKET_TRIGGER_RADIUS = 3;

export const JOYSTICK_OUTER_RADIUS_PX = 62;
export const JOYSTICK_KNOB_RADIUS_PX = 24;
export const JOYSTICK_DEAD_ZONE = 0.12;

export const CAMERA_DISTANCE = 9;
export const CAMERA_HEIGHT = 4;
export const CAMERA_LOOK_HEIGHT = 1.2;
