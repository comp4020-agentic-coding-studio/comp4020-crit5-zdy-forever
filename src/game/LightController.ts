import {
  DARK_SECONDS_EARLY,
  DARK_SECONDS_LATE,
  DARK_SECONDS_MID,
  DIFFICULTY_LATE_PROGRESS,
  DIFFICULTY_MID_PROGRESS,
  LIGHT_ON_SECONDS_EARLY,
  LIGHT_ON_SECONDS_LATE,
  LIGHT_ON_SECONDS_MID,
  WARNING_SECONDS_EARLY,
  WARNING_SECONDS_LATE,
  WARNING_SECONDS_MID,
} from "./Constants.ts";

export type LightState = "on" | "warning" | "dark";
type Tier = "early" | "mid" | "late";

function pickDuration([min, max]: readonly [number, number]): number {
  return min + Math.random() * (max - min);
}

type WarningPattern = (elapsedSeconds: number, durationSeconds: number) => number;

// A handful of distinct flicker feels for the WARNING phase, one picked at
// random each time the light enters it -- so the "lights are about to go"
// moment doesn't always read the same way twice. Every pattern still respects
// the same accessibility floor as the original: no state change faster than
// ~0.25-0.35s (a slow, deliberate flicker, never a rapid strobe).
const WARNING_PATTERNS: readonly WarningPattern[] = [
  // Steady alternation -- the original pattern.
  (elapsed) => (Math.floor(elapsed / 0.25) % 2 === 0 ? 0.15 : 0.9),
  // A slow, smooth breathing pulse -- no hard cuts at all.
  (elapsed) => 0.2 + 0.325 * (1 + Math.sin((elapsed / 1.2) * Math.PI * 2)),
  // Alternates on a slower, deeper swing than the steady pattern.
  (elapsed) => (Math.floor(elapsed / 0.35) % 2 === 0 ? 0.1 : 0.85),
  // Gradually dims across the whole warning window, with a slow wobble on
  // top -- reads as the light genuinely failing, not just blinking.
  (elapsed, duration) => {
    const decay = 1 - 0.65 * Math.min(1, elapsed / Math.max(duration, 0.001));
    const wobble = Math.floor(elapsed / 0.3) % 2 === 0 ? -0.05 : 0.05;
    return Math.min(1, Math.max(0.05, decay + wobble));
  },
];

function pickWarningPattern(): WarningPattern {
  return WARNING_PATTERNS[Math.floor(Math.random() * WARNING_PATTERNS.length)];
}

function tierFor(progress: number): Tier {
  if (progress >= DIFFICULTY_LATE_PROGRESS) return "late";
  if (progress >= DIFFICULTY_MID_PROGRESS) return "mid";
  return "early";
}

const ON_DURATIONS: Record<Tier, readonly [number, number]> = {
  early: LIGHT_ON_SECONDS_EARLY,
  mid: LIGHT_ON_SECONDS_MID,
  late: LIGHT_ON_SECONDS_LATE,
};
const WARNING_DURATIONS: Record<Tier, readonly [number, number]> = {
  early: WARNING_SECONDS_EARLY,
  mid: WARNING_SECONDS_MID,
  late: WARNING_SECONDS_LATE,
};
const DARK_DURATIONS: Record<Tier, readonly [number, number]> = {
  early: DARK_SECONDS_EARLY,
  mid: DARK_SECONDS_MID,
  late: DARK_SECONDS_LATE,
};

// Cycles ON -> WARNING -> DARK -> ON indefinitely. Durations are drawn from a
// tier keyed by the player's progress along the corridor (0..1), not
// wall-clock time, so pacing tightens as the player advances rather than
// racing an independent clock. `forceDark` overrides the cycle with a single
// longer dark period (the final-stretch sequence near the exit) without
// introducing an extra state.
export class LightController {
  state: LightState = "on";
  private elapsed = 0;
  private duration = pickDuration(LIGHT_ON_SECONDS_EARLY);
  private forcedDarkSecondsRemaining = 0;
  private warningPattern: WarningPattern = WARNING_PATTERNS[0];

  reset(): void {
    this.state = "on";
    this.elapsed = 0;
    this.duration = pickDuration(LIGHT_ON_SECONDS_EARLY);
    this.forcedDarkSecondsRemaining = 0;
    this.warningPattern = WARNING_PATTERNS[0];
  }

  // A no-op if already in a forced blackout, so the final stretch can only
  // ever trigger once.
  forceDark(seconds: number): void {
    if (this.forcedDarkSecondsRemaining > 0) return;
    this.state = "dark";
    this.elapsed = 0;
    this.forcedDarkSecondsRemaining = seconds;
  }

  update(progress: number, deltaSeconds: number): void {
    if (this.forcedDarkSecondsRemaining > 0) {
      this.forcedDarkSecondsRemaining -= deltaSeconds;
      if (this.forcedDarkSecondsRemaining > 0) return;
      this.forcedDarkSecondsRemaining = 0;
      this.state = "on";
      this.elapsed = 0;
      this.duration = pickDuration(ON_DURATIONS[tierFor(progress)]);
      return;
    }

    this.elapsed += deltaSeconds;
    if (this.elapsed < this.duration) return;

    const tier = tierFor(progress);
    this.elapsed = 0;
    if (this.state === "on") {
      this.state = "warning";
      this.duration = pickDuration(WARNING_DURATIONS[tier]);
      this.warningPattern = pickWarningPattern();
    } else if (this.state === "warning") {
      this.state = "dark";
      this.duration = pickDuration(DARK_DURATIONS[tier]);
    } else {
      this.state = "on";
      this.duration = pickDuration(ON_DURATIONS[tier]);
    }
  }

  // 0 (fully dark) to 1 (steady on). During WARNING this follows whichever
  // pattern was randomly picked on entering the state (see
  // WARNING_PATTERNS) -- all of them stay a slow, deliberate flicker rather
  // than a rapid strobe, per the accessibility requirement that the warning
  // flicker never read as rapid/strobing.
  get intensity(): number {
    if (this.state === "on") return 1;
    if (this.state === "dark") return 0;
    return this.warningPattern(this.elapsed, this.duration);
  }
}
