import { Vector3 } from "three";
import { GHOST_INITIAL_DISTANCE } from "./Constants.ts";

// Not a roaming AI -- just a hidden danger-distance scalar that Game.ts
// decreases whenever GameRules says a move was made illegally in the dark.
// Its world position is always directly behind the player along the
// corridor (smaller Z), independent of which way the player is currently
// facing -- so backing up to actually look behind you reveals it exactly
// where it's been the whole time, rather than it "appearing" wherever your
// camera happens to be pointed. It has no light of its own in SceneManager,
// so it's genuinely hard to see while the corridor is dark and is mostly
// only visible once the lights return.
export class Ghost {
  distance = GHOST_INITIAL_DISTANCE;

  reset(): void {
    this.distance = GHOST_INITIAL_DISTANCE;
  }

  positionBehind(playerPositionZ: number, out: Vector3): Vector3 {
    return out.set(0, 0, playerPositionZ - this.distance);
  }
}
