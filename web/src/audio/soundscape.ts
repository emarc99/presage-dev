import type { GazeZone, TonalEcho } from '../types/signals';

class ProceduralSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private panner: StereoPannerNode | null = null;
  private oscRoot: OscillatorNode | null = null;
  private oscFifth: OscillatorNode | null = null;
  private oscAir: OscillatorNode | null = null;
  private muted = false;
  private initialized = false;

  ensureStarted(baseHz = 196) {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.055;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 540;
    this.filter.Q.value = 0.7;

    this.panner = this.ctx.createStereoPanner();
    this.panner.pan.value = 0;

    this.filter.connect(this.panner);
    this.panner.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.oscRoot = this.ctx.createOscillator();
    this.oscRoot.type = 'sine';
    this.oscRoot.frequency.value = baseHz * 0.5;

    this.oscFifth = this.ctx.createOscillator();
    this.oscFifth.type = 'triangle';
    this.oscFifth.frequency.value = baseHz * 0.75;
    const fifthGain = this.ctx.createGain();
    fifthGain.gain.value = 0.35;

    this.oscAir = this.ctx.createOscillator();
    this.oscAir.type = 'sine';
    this.oscAir.frequency.value = baseHz;
    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.25;

    this.oscRoot.connect(this.filter);
    this.oscFifth.connect(fifthGain);
    fifthGain.connect(this.filter);
    this.oscAir.connect(airGain);
    airGain.connect(this.filter);

    this.oscRoot.start();
    this.oscFifth.start();
    this.oscAir.start();
    this.initialized = true;
  }

  setSceneTone(baseHz: number) {
    if (!this.ctx || !this.oscRoot || !this.oscFifth || !this.oscAir) return;
    const now = this.ctx.currentTime;
    this.oscRoot.frequency.setTargetAtTime(baseHz * 0.5, now, 0.35);
    this.oscFifth.frequency.setTargetAtTime(baseHz * 0.75, now, 0.35);
    this.oscAir.frequency.setTargetAtTime(baseHz, now, 0.35);
  }

  update(steadiness: number, echo: TonalEcho, gaze: GazeZone) {
    if (!this.ctx || !this.filter || !this.panner || !this.oscAir) return;
    const now = this.ctx.currentTime;
    const norm = Math.min(1, Math.max(0, steadiness / 100));
    const cutoff = 260 + norm * 1050;
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.25);

    const pan = gaze === 'left' ? -0.28 : gaze === 'right' ? 0.28 : 0;
    this.panner.pan.setTargetAtTime(pan, now, 0.22);

    const detuneCents = echo === 'warm' ? 7 : echo === 'heavy' ? -14 : 0;
    this.oscAir.detune.setTargetAtTime(detuneCents, now, 0.4);
  }

  playShutterClick() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(160, now);
    clickOsc.frequency.exponentialRampToValueAtTime(48, now + 0.035);
    clickGain.gain.setValueAtTime(0.18, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.045);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.055, this.ctx.currentTime, 0.08);
    }
  }

  isMuted() {
    return this.muted;
  }

  dispose() {
    if (!this.ctx) return;
    try {
      this.oscRoot?.stop();
      this.oscFifth?.stop();
      this.oscAir?.stop();
      void this.ctx.close();
    } catch {
      // ignore audio context teardown errors
    }
    this.ctx = null;
    this.initialized = false;
  }
}

export const soundscape = new ProceduralSoundscape();
