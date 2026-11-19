// Pure, scale-invariant SmartSpectra signal processor (zero native SDK dependency).

const LEFT_EYE_CORNERS = [33, 133];
const LEFT_EYE_VERT = [
  [159, 145],
  [160, 144],
];
const RIGHT_EYE_CORNERS = [263, 362];
const RIGHT_EYE_VERT = [
  [386, 374],
  [385, 373],
];
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;
const NOSE_TIP = 1;
const CHEEK_A = 234;
const CHEEK_B = 454;

// Compact face oval + eyebrow indices for privacy-safe silhouette preview
const SILHOUETTE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

// MediaPipe/SmartSpectra ExpressionType enum codes
const EXPR_ANGRY = 1;
const EXPR_FEAR = 4;
const EXPR_HAPPY = 5;
const EXPR_NEUTRAL = 6;
const EXPR_SAD = 7;

function dist(a, b) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dy = (a?.y ?? 0) - (b?.y ?? 0);
  return Math.hypot(dx, dy);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function computeEarFromEye(pts, corners, verts) {
  if (!pts || pts.length <= Math.max(corners[1], verts[1][1])) return null;
  const width = dist(pts[corners[0]], pts[corners[1]]);
  if (width <= 1e-6) return null;
  const v1 = dist(pts[verts[0][0]], pts[verts[0][1]]);
  const v2 = dist(pts[verts[1][0]], pts[verts[1][1]]);
  return (v1 + v2) / (2 * width);
}

export function computeMeanEar(pts) {
  const left = computeEarFromEye(pts, LEFT_EYE_CORNERS, LEFT_EYE_VERT);
  const right = computeEarFromEye(pts, RIGHT_EYE_CORNERS, RIGHT_EYE_VERT);
  if (left !== null && right !== null) return (left + right) / 2;
  return left ?? right;
}

export function computeGazeScalar(pts, mirrorX = true) {
  if (!pts || pts.length <= CHEEK_B) return null;
  const samples = [];

  if (pts.length > RIGHT_IRIS) {
    const lSpan = pts[LEFT_EYE_CORNERS[1]].x - pts[LEFT_EYE_CORNERS[0]].x;
    if (Math.abs(lSpan) > 1e-6) {
      samples.push((pts[LEFT_IRIS].x - pts[LEFT_EYE_CORNERS[0]].x) / lSpan);
    }
    const rSpan = pts[RIGHT_EYE_CORNERS[1]].x - pts[RIGHT_EYE_CORNERS[0]].x;
    if (Math.abs(rSpan) > 1e-6) {
      samples.push((pts[RIGHT_EYE_CORNERS[1]].x - pts[RIGHT_IRIS].x) / rSpan);
    }
  }

  let irisRatio =
    samples.length > 0
      ? samples.reduce((acc, v) => acc + clamp(v, 0, 1), 0) / samples.length
      : 0.5;

  // Blend coarse head-yaw cue (nose tip inside cheek span)
  const cA = pts[CHEEK_A].x;
  const cB = pts[CHEEK_B].x;
  const cheekSpan = cB - cA;
  let yawRatio = 0.5;
  if (Math.abs(cheekSpan) > 1e-6) {
    yawRatio = clamp((pts[NOSE_TIP].x - cA) / cheekSpan, 0, 1);
  }

  const raw = clamp(irisRatio * 0.7 + yawRatio * 0.3, 0, 1);
  return mirrorX ? 1 - raw : raw;
}

export function extractSilhouette(pts) {
  if (!pts || pts.length <= CHEEK_B) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const idx of SILHOUETTE_OVAL) {
    const p = pts[idx];
    if (!p) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  return SILHOUETTE_OVAL.map((idx) => {
    const p = pts[idx];
    return {
      x: Number(((p.x - minX) / spanX).toFixed(3)),
      y: Number(((p.y - minY) / spanY).toFixed(3)),
    };
  });
}

export class SignalProcessor {
  constructor(options = {}) {
    this.mirrorX = options.mirrorX ?? true;
    this.earBlinkThreshold = options.earBlinkThreshold ?? 0.19;
    this.minBlinkGapMs = options.minBlinkGapMs ?? 320;
    this.longBlinkMs = options.longBlinkMs ?? 1100;
    this.breathWindowMs = options.breathWindowMs ?? 4500;
    this.gazeAlpha = options.gazeAlpha ?? 0.25;
    this.reset();
  }

  reset() {
    this.lastBlinkEmitMs = -Infinity;
    this.eyesClosedSinceMs = null;
    this.longBlinkFired = false;
    this.wasLowEar = false;
    this.gazeEma = 0.5;
    this.gazeZone = 'center';
    this.breathSamples = [];
    this.lastBreathSteadiness = 55;
    this.latestBreathRate = null;
    this.latestBreathConfidence = 0;
    this.exprWarmEma = 0;
    this.exprHeavyEma = 0;
    this.echo = 'neutral';
    this.lastSilhouette = null;
    this.lastEar = null;
  }

  process(decodedMetrics, nowMs = Date.now()) {
    const m = decodedMetrics || {};
    let blinkCut = false;
    let longBlinkPause = false;
    let faceDetected = false;

    // 1. Face landmarks: EAR, Blink fallback, Coarse Gaze, Silhouette
    const landmarkFrames = m.face?.landmarks || [];
    if (landmarkFrames.length > 0) {
      const latest = landmarkFrames[landmarkFrames.length - 1];
      const pts = latest?.value || [];
      if (pts.length >= 468) {
        faceDetected = true;
        const ear = computeMeanEar(pts);
        if (ear !== null) {
          this.lastEar = ear;
          const isLow = ear < this.earBlinkThreshold;
          if (isLow && !this.wasLowEar) {
            this.eyesClosedSinceMs = nowMs;
            this.longBlinkFired = false;
            if (nowMs - this.lastBlinkEmitMs >= this.minBlinkGapMs) {
              blinkCut = true;
              this.lastBlinkEmitMs = nowMs;
            }
          } else if (isLow && this.eyesClosedSinceMs !== null) {
            if (!this.longBlinkFired && nowMs - this.eyesClosedSinceMs >= this.longBlinkMs) {
              longBlinkPause = true;
              this.longBlinkFired = true;
            }
          } else if (!isLow) {
            this.eyesClosedSinceMs = null;
            this.longBlinkFired = false;
          }
          this.wasLowEar = isLow;
        }

        const gazeRaw = computeGazeScalar(pts, this.mirrorX);
        if (gazeRaw !== null) {
          this.gazeEma = this.gazeEma * (1 - this.gazeAlpha) + gazeRaw * this.gazeAlpha;
          if (this.gazeZone === 'center') {
            if (this.gazeEma < 0.41) this.gazeZone = 'left';
            else if (this.gazeEma > 0.59) this.gazeZone = 'right';
          } else if (this.gazeZone === 'left' && this.gazeEma > 0.46) {
            this.gazeZone = 'center';
          } else if (this.gazeZone === 'right' && this.gazeEma < 0.54) {
            this.gazeZone = 'center';
          }
        }

        this.lastSilhouette = extractSilhouette(pts);
      }
    }

    // 2. SmartSpectra native blinking onset pulses
    for (const b of m.face?.blinking || []) {
      if (b?.detected) {
        if (nowMs - this.lastBlinkEmitMs >= this.minBlinkGapMs) {
          blinkCut = true;
          this.lastBlinkEmitMs = nowMs;
        }
      }
    }

    // 3. Rolling 4.5s chest breathing steadiness (immune to ~1s phase lag)
    const upperSamples = m.breathing?.upperTrace || [];
    for (let i = 0; i < upperSamples.length; i += 1) {
      const sample = upperSamples[i];
      if (typeof sample?.value !== 'number' || !Number.isFinite(sample.value)) continue;
      const sampleTs =
        upperSamples.length > 1
          ? nowMs - (upperSamples.length - 1 - i) * 33
          : nowMs;
      this.breathSamples.push({ ts: sampleTs, value: sample.value });
    }
    const cutoff = nowMs - this.breathWindowMs;
    while (this.breathSamples.length > 0 && this.breathSamples[0].ts < cutoff) {
      this.breathSamples.shift();
    }

    const { steadiness, wave } = this._computeBreathSteadiness();
    this.lastBreathSteadiness = steadiness;

    const rates = m.breathing?.rate || [];
    if (rates.length > 0) {
      const last = rates[rates.length - 1];
      if (typeof last?.value === 'number' && Number.isFinite(last.value)) {
        this.latestBreathRate = Number(last.value.toFixed(1));
        this.latestBreathConfidence = Number((last.confidence ?? 0).toFixed(0));
      }
    }

    // 4. Subtle Tonal Echo from expression probabilities
    const exprs = m.face?.expression || [];
    if (exprs.length > 0) {
      const lastExp = exprs[exprs.length - 1];
      let happy = 0;
      let heavy = 0;
      for (const s of lastExp?.scores || []) {
        const conf = s?.confidence ?? 0;
        if (s?.type === EXPR_HAPPY) happy = conf;
        if (s?.type === EXPR_SAD || s?.type === EXPR_FEAR || s?.type === EXPR_ANGRY) {
          heavy = Math.max(heavy, conf);
        }
      }
      this.exprWarmEma = this.exprWarmEma * 0.78 + happy * 0.22;
      this.exprHeavyEma = this.exprHeavyEma * 0.78 + heavy * 0.22;
      if (this.exprWarmEma >= 38 && this.exprWarmEma > this.exprHeavyEma + 8) {
        this.echo = 'warm';
      } else if (this.exprHeavyEma >= 38 && this.exprHeavyEma > this.exprWarmEma + 8) {
        this.echo = 'heavy';
      } else if (this.exprWarmEma < 28 && this.exprHeavyEma < 28) {
        this.echo = 'neutral';
      }
    }

    return {
      ts: nowMs,
      faceDetected,
      blinkCut,
      longBlinkPause,
      ear: this.lastEar !== null ? Number(this.lastEar.toFixed(3)) : null,
      gaze: this.gazeZone,
      gazeScalar: Number(this.gazeEma.toFixed(3)),
      breathSteadiness: this.lastBreathSteadiness,
      breathRate: this.latestBreathRate,
      breathConfidence: this.latestBreathConfidence,
      breathWave: wave,
      echo: this.echo,
      silhouette: this.lastSilhouette,
    };
  }

  _computeBreathSteadiness() {
    const arr = this.breathSamples;
    if (arr.length < 10) {
      return { steadiness: this.lastBreathSteadiness, wave: [] };
    }
    const spanMs = arr[arr.length - 1].ts - arr[0].ts;
    if (spanMs < 1200) {
      return { steadiness: this.lastBreathSteadiness, wave: [] };
    }

    let mean = 0;
    for (const s of arr) mean += s.value;
    mean /= arr.length;

    const centered = arr.map((s) => s.value - mean);
    let minV = Infinity;
    let maxV = -Infinity;
    for (const v of centered) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const range = maxV - minV;

    // Resample to 36 points in [-1..1] for crisp UI wave drawing
    const wave = [];
    const targetLen = 36;
    const halfSpan = Math.max(range / 2, 1e-4);
    for (let i = 0; i < targetLen; i += 1) {
      const idx = Math.min(
        centered.length - 1,
        Math.round((i / (targetLen - 1)) * (centered.length - 1))
      );
      wave.push(Number(clamp(centered[idx] / halfSpan, -1, 1).toFixed(3)));
    }

    // Flatline / screen-apnea check (no chest oscillation over window)
    if (range < 1e-4) {
      return { steadiness: 22, wave: new Array(targetLen).fill(0) };
    }

    // Smoothness metric: ratio of 2nd-difference curvature RMS to amplitude std
    let sumSq = 0;
    for (const v of centered) sumSq += v * v;
    const std = Math.sqrt(sumSq / centered.length);

    let d1Sq = 0;
    for (let i = 1; i < centered.length; i += 1) {
      const d = centered[i] - centered[i - 1];
      d1Sq += d * d;
    }
    const d1Rms = Math.sqrt(d1Sq / (centered.length - 1));

    let d2Sq = 0;
    for (let i = 2; i < centered.length; i += 1) {
      const d2 = centered[i] - 2 * centered[i - 1] + centered[i - 2];
      d2Sq += d2 * d2;
    }
    const d2Rms = Math.sqrt(d2Sq / Math.max(1, centered.length - 2));

    // For a clean 0.2 Hz respiratory sine sampled ~20-30Hz: d2Rms/std is tiny (<0.08),
    // and d2Rms/d1Rms is well below 0.35. Erratic erratic/noisy jolts drive ratio > 1.0.
    const highFreqRatio = d2Rms / Math.max(d1Rms, 1e-6);
    const accelRatio = d2Rms / Math.max(std, 1e-6);
    const rawPenalty = highFreqRatio * 48 + accelRatio * 55;
    const score = Math.round(clamp(96 - rawPenalty, 12, 98));

    return { steadiness: score, wave };
  }
}

export { EXPR_ANGRY, EXPR_FEAR, EXPR_HAPPY, EXPR_NEUTRAL, EXPR_SAD };
