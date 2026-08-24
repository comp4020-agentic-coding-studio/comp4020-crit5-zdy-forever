// Everything here is procedural WebAudio -- no audio files. An ambient hum is
// always present once started; a heartbeat and a breathing layer fade in as
// ghostDistance shrinks toward the loss threshold; footstep thumps mark each
// moment the darkness-movement rule actually penalises a move, so the danger
// is heard building rather than only seen on a vignette.
export class AudioManager {
  private context: AudioContext | null = null;
  private heartbeatGain: GainNode | null = null;
  private breathingGain: GainNode | null = null;
  private lastFootstepTime = 0;

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
    this.buildAmbientHum(context);
    this.heartbeatGain = this.buildSilentBus(context);
    this.breathingGain = this.buildBreathingLoop(context);
    this.scheduleHeartbeat();
  }

  // danger: 0 (safe) .. 1 (about to be caught). illegalMovementNow: true only
  // on frames GameRules is actively penalising -- used to space out footstep
  // thumps rather than firing one every frame.
  sync(danger: number, illegalMovementNow: boolean): void {
    const context = this.context;
    if (!context || !this.heartbeatGain || !this.breathingGain) return;

    const heartbeatTarget = danger > 0.35 ? Math.min(1, (danger - 0.35) / 0.5) * 0.5 : 0;
    const breathingTarget = danger > 0.7 ? ((danger - 0.7) / 0.3) * 0.35 : 0;
    this.heartbeatGain.gain.setTargetAtTime(heartbeatTarget, context.currentTime, 0.4);
    this.breathingGain.gain.setTargetAtTime(breathingTarget, context.currentTime, 0.4);

    if (illegalMovementNow && context.currentTime - this.lastFootstepTime > 0.28) {
      this.lastFootstepTime = context.currentTime;
      this.playFootstep(danger);
    }
  }

  playLossStinger(): void {
    this.playStinger(90, 0.9, 1.1);
  }

  playWinStinger(): void {
    this.playStinger(220, 0.5, 0.4);
  }

  private buildNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private buildAmbientHum(context: AudioContext): void {
    const noise = context.createBufferSource();
    noise.buffer = this.buildNoiseBuffer(context, 4);
    noise.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;

    const gain = context.createGain();
    gain.gain.value = 0.04;

    noise.connect(filter).connect(gain).connect(context.destination);
    noise.start();
  }

  private buildSilentBus(context: AudioContext): GainNode {
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    return gain;
  }

  private buildBreathingLoop(context: AudioContext): GainNode {
    const noise = context.createBufferSource();
    noise.buffer = this.buildNoiseBuffer(context, 3);
    noise.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 0.6;

    const gain = context.createGain();
    gain.gain.value = 0;

    noise.connect(filter).connect(gain).connect(context.destination);
    noise.start();
    return gain;
  }

  // Reschedules itself indefinitely, reading whatever gain heartbeatGain
  // currently holds to pick its own tempo -- there's no teardown because
  // this is a single-page game with no navigation away from it.
  private scheduleHeartbeat(): void {
    const context = this.context;
    const heartbeatGain = this.heartbeatGain;
    if (!context || !heartbeatGain) return;

    for (const [offset, frequency] of [
      [0, 65],
      [0.14, 55],
    ] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const envelope = context.createGain();
      const startTime = context.currentTime + offset;
      envelope.gain.setValueAtTime(0, startTime);
      envelope.gain.linearRampToValueAtTime(1, startTime + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      oscillator.connect(envelope).connect(heartbeatGain);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    }

    const intervalSeconds = heartbeatGain.gain.value > 0.35 ? 0.55 : 0.9;
    window.setTimeout(() => this.scheduleHeartbeat(), intervalSeconds * 1000);
  }

  private playFootstep(danger: number): void {
    const context = this.context;
    if (!context) return;

    const noise = context.createBufferSource();
    noise.buffer = this.buildNoiseBuffer(context, 0.2);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300 + danger * 200;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.15 + danger * 0.25, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);

    noise.connect(filter).connect(envelope).connect(context.destination);
    noise.start();
  }

  private playStinger(frequency: number, gainPeak: number, durationSeconds: number): void {
    const context = this.context;
    if (!context) return;

    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * 0.3), context.currentTime + durationSeconds);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gainPeak, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + durationSeconds);

    oscillator.connect(envelope).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + durationSeconds + 0.05);
  }
}
