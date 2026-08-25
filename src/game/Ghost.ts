import { Vector3 } from "three";
import { GHOST_INITIAL_DISTANCE } from "./Constants.ts";

// Not a roaming AI -- just a hidden danger-distance scalar that Game.ts
// decreases whenever GameRules says a move was made illegally in the dark.
// Its world position is placed by walking backward along the player's own
// breadcrumb trail (see Game.ts) rather than a straight line, so it always
// sits on ground the player genuinely walked through the maze -- turning
// around via the camera mechanism reveals it exactly where it's been, never
// cutting through a wall to get there. It has no light of its own in
// SceneManager, so it's genuinely hard to see while dark and is mostly only
// visible once the lights return.
export class Ghost {
  distance = GHOST_INITIAL_DISTANCE;

  reset(): void {
    this.distance = GHOST_INITIAL_DISTANCE;
  }

  // Walks backward from the trail's newest point, accumulating segment
  // length until it covers `distance`; clamps to the trail's oldest point if
  // `distance` exceeds the trail's own length (shouldn't happen given the
  // trail is kept longer than GHOST_INITIAL_DISTANCE, but a clamp is cheap
  // insurance against ever reading past the array).
  positionBehind(trail: readonly Vector3[], distance: number, out: Vector3): Vector3 {
    if (trail.length === 0) return out.set(0, 0, 0);

    let remaining = distance;
    for (let i = trail.length - 1; i > 0; i--) {
      const from = trail[i];
      const to = trail[i - 1];
      const segmentLength = from.distanceTo(to);
      if (remaining <= segmentLength) {
        const t = segmentLength > 1e-8 ? remaining / segmentLength : 0;
        return out.copy(from).lerp(to, t);
      }
      remaining -= segmentLength;
    }
    return out.copy(trail[0]);
  }
}
