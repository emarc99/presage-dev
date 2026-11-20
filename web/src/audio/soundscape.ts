import type { GazeZone, TonalEcho } from '../types/signals';

class ProceduralSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private panner: StereoPannerNode | null = null;
  private oscRoot: OscillatorNode | null = null;
  private oscFifth: OscillatorNode | null = null;
  private oscAir: OscillatorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
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

    // Filtered pink-noise breath & rain air bed
    const bufLen = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const out = noiseBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufLen; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }
    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuf;
    this.noiseSource.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 460;
    this.noiseFilter.Q.value = 0.8;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.22;

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.panner);
    this.noiseSource.start();

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

  update(steadiness: number, echo: TonalEcho, gaze: GazeZone, breathPhase = 0) {
    if (!this.ctx || !this.filter || !this.panner || !this.oscAir) return;
    const now = this.ctx.currentTime;
    const norm = Math.min(1, Math.max(0, steadiness / 100));
    const cutoff = 260 + norm * 1050;
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.25);

    const pan = gaze === 'left' ? -0.28 : gaze === 'right' ? 0.28 : 0;
    this.panner.pan.setTargetAtTime(pan, now, 0.22);

    const detuneCents = echo === 'warm' ? 7 : echo === 'heavy' ? -14 : 0;
    this.oscAir.detune.setTargetAtTime(detuneCents, now, 0.4);

    if (this.noiseFilter && this.noiseGain) {
      const breathMod = Math.max(-1, Math.min(1, breathPhase));
      this.noiseFilter.frequency.setTargetAtTime(380 + norm * 320 + breathMod * 120, now, 0.2);
      this.noiseGain.gain.setTargetAtTime(0.16 + Math.abs(breathMod) * 0.14, now, 0.2);
    }
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

  playMarginaliaChime() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      g.gain.setValueAtTime(0.0001, now + idx * 0.09);
      g.gain.linearRampToValueAtTime(0.045, now + idx * 0.09 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0005, now + idx * 0.09 + 1.05);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 1.1);
    });
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
      this.noiseSource?.stop();
      void this.ctx.close();
    } catch {
      // ignore audio context teardown errors
    }
    this.ctx = null;
    this.initialized = false;
  }
}

export const soundscape = new ProceduralSoundscape();
