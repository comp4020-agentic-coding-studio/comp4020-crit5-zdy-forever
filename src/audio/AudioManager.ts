import { DREAD_MEDIUM_DISTANCE, DREAD_NEAR_DISTANCE } from "../game/Constants.ts";

type Tier = "far" | "medium" | "near";

// Everything here is procedural WebAudio -- no audio files. A filtered noise
// loop stands in for wind and is always present once started; a low thump
// fades in and quickens as the ghost closes in, without ever calling itself
// a heartbeat.
export class AudioManager {
  private context: AudioContext | null = null;
  private thumpGain: GainNode | null = null;
  private currentTier: Tier = "far";

  // Must be called from inside a user-gesture handler (the start button) --
  // that's what satisfies the autoplay policy without ever showing a
  // permission prompt.
  start(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }

    const context = new AudioContext();
    this.context = context;
    this.buildWind(context);
    this.thumpGain = this.buildThumpBus(context);
    this.scheduleThump();
  }

  setGhostDistance(distance: number): void {
    if (!this.context || !this.thumpGain) return;

    const tier: Tier = distance <= DREAD_NEAR_DISTANCE ? "near" : distance <= DREAD_MEDIUM_DISTANCE ? "medium" : "far";
    if (tier === this.currentTier) return;
    this.currentTier = tier;

    const targetGain = tier === "far" ? 0 : tier === "medium" ? 0.1 : 0.22;
    this.thumpGain.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.4);
  }

  private buildWind(context: AudioContext): void {
    const bufferSeconds = 4;
    const buffer = context.createBuffer(1, context.sampleRate * bufferSeconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;

    const gain = context.createGain();
    gain.gain.value = 0.05;

    noise.connect(filter).connect(gain).connect(context.destination);
    noise.start();
  }

  private buildThumpBus(context: AudioContext): GainNode {
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    return gain;
  }

  // Reschedules itself indefinitely -- there's no teardown because this is a
  // single-page game with no navigation away from it. Silent (thumpGain at
  // 0) while the ghost is far, so the far tier costs a little CPU but no
  // audible output.
  private scheduleThump(): void {
    const context = this.context;
    const thumpGain = this.thumpGain;
    if (!context || !thumpGain) return;

    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = 55;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.linearRampToValueAtTime(1, context.currentTime + 0.03);
    envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);

    oscillator.connect(envelope).connect(thumpGain);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);

    const intervalSeconds = this.currentTier === "near" ? 0.75 : 1.4;
    window.setTimeout(() => this.scheduleThump(), intervalSeconds * 1000);
  }
}
