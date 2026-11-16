/**
 * Procedural Web Audio API synthesizer for electric kickboard, footsteps, bell, warnings, and police siren.
 * Uses soft filtered breeze/tire roll instead of harsh low-frequency buzz.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private rollNoiseSource: AudioBufferSourceNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private rollGain: GainNode | null = null;
  private motorOsc: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private sirenTimer = 0;
  private footstepTimer = 0;
  private warningTimer = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    const ctx = this.ensureContext();
    if (!ctx || this.rollNoiseSource) return;
    try {
      // 1. Soft pink-noise buffer for gentle tire-on-asphalt + breeze rolling sound
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.09;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      filter.Q.value = 0.6;

      const rollGain = ctx.createGain();
      rollGain.gain.value = 0;

      noise.connect(filter);
      filter.connect(rollGain);
      rollGain.connect(ctx.destination);
      noise.start();

      this.rollNoiseSource = noise;
      this.rollFilter = filter;
      this.rollGain = rollGain;

      // 2. Ultra-subtle clean sine electric shimmer (no harsh low drone)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 420;
      oscGain.gain.value = 0;
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start();
      this.motorOsc = osc;
      this.motorGain = oscGain;
    } catch {
      // Ignore audio init errors
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted && this.ctx) {
      if (this.rollGain) {
        this.rollGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      }
      if (this.motorGain) {
        this.motorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateContinuous(
    dt: number,
    speedKmh: number,
    isDismounted: boolean,
    isChasing: boolean,
    isViolation: boolean,
    isPlaying: boolean
  ) {
    if (this.muted || !this.ctx || !isPlaying) {
      if (this.ctx) {
        if (this.rollGain) {
          this.rollGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
        }
        if (this.motorGain) {
          this.motorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
        }
      }
      return;
    }

    const now = this.ctx.currentTime;

    // Gentle tire/breeze rolling sound + airy high sine whisper
    if (!isDismounted && speedKmh > 0.8) {
      const norm = Math.min(speedKmh / 25, 1);
      if (this.rollFilter && this.rollGain) {
        this.rollFilter.frequency.setTargetAtTime(280 + norm * 520, now, 0.08);
        this.rollGain.gain.setTargetAtTime(0.006 + norm * 0.022, now, 0.08);
      }
      if (this.motorOsc && this.motorGain) {
        this.motorOsc.frequency.setTargetAtTime(420 + norm * 240, now, 0.08);
        this.motorGain.gain.setTargetAtTime(0.0015 + norm * 0.0045, now, 0.08);
      }
    } else {
      if (this.rollGain) {
        this.rollGain.gain.setTargetAtTime(0, now, 0.07);
      }
      if (this.motorGain) {
        this.motorGain.gain.setTargetAtTime(0, now, 0.07);
      }
    }

    // Walking footsteps when dismounted & moving
    if (isDismounted && speedKmh > 0.8) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.36;
        this.playFootstep();
      }
    } else {
      this.footstepTimer = 0.1;
    }

    // Police siren oscillation
    if (isChasing) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.72;
        this.playSirenPulse();
      }
    } else {
      this.sirenTimer = 0;
    }

    // Gentle soft reminder chime during 5s return grace
    if (isViolation && !isChasing) {
      this.warningTimer -= dt;
      if (this.warningTimer <= 0) {
        this.warningTimer = 1.65;
        this.playWarningBeep();
      }
    } else {
      this.warningTimer = 0.25;
    }
  }

  public playBell() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [1560, 2340];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.04);
      gain.gain.setValueAtTime(0.075, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.42 + idx * 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + 0.48 + idx * 0.04);
    });
  }

  public playDismountToggle(dismounted: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(dismounted ? 480 : 340, now);
    osc.frequency.exponentialRampToValueAtTime(dismounted ? 330 : 520, now + 0.1);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playCheckpoint() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.065, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + i * 0.07 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.27);
    });
  }

  public playTicketIssued() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(620, now);
    osc1.frequency.setValueAtTime(460, now + 0.14);
    gain1.gain.setValueAtTime(0.075, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);
  }

  public playCollision() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playSplash() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.2);
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playPetAlert(kind: 'dog' | 'cat') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (kind === 'dog') {
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.07);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.18);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    }
  }

  private playWarningBeep() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.setValueAtTime(490, now + 0.1);
    gain.gain.setValueAtTime(0.028, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  private playSirenPulse() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.linearRampToValueAtTime(920, now + 0.34);
    osc.frequency.linearRampToValueAtTime(640, now + 0.68);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.71);
  }

  private playFootstep() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public dispose() {
    if (this.rollNoiseSource) {
      try {
        this.rollNoiseSource.stop();
      } catch {
        // ignore
      }
      this.rollNoiseSource = null;
    }
    if (this.motorOsc) {
      try {
        this.motorOsc.stop();
      } catch {
        // ignore
      }
      this.motorOsc = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
