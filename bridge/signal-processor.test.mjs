import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SignalProcessor,
  computeMeanEar,
  computeGazeScalar,
  extractSilhouette,
  EXPR_HAPPY,
  EXPR_SAD,
  EXPR_NEUTRAL,
} from './signal-processor.mjs';

function makeFaceLandmarks({ scaleX = 1, scaleY = 1, ear = 0.32, gazeOffset = 0 } = {}) {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5 * scaleX, y: 0.5 * scaleY }));
  const set = (idx, x, y) => {
    pts[idx] = { x: x * scaleX, y: y * scaleY };
  };

  // Cheeks & nose
  set(234, 0.30, 0.52);
  set(454, 0.70, 0.52);
  set(1, 0.50 + gazeOffset * 0.04, 0.52);

  // Left eye width = 0.08 -> vertical distance = ear * 0.08
  const halfVert = (ear * 0.08) / 2;
  set(33, 0.36, 0.42);
  set(133, 0.44, 0.42);
  set(159, 0.39, 0.42 - halfVert);
  set(160, 0.41, 0.42 - halfVert);
  set(145, 0.39, 0.42 + halfVert);
  set(144, 0.41, 0.42 + halfVert);
  set(468, 0.40 + gazeOffset * 0.025, 0.42);

  // Right eye width = 0.08
  set(362, 0.56, 0.42);
  set(263, 0.64, 0.42);
  set(386, 0.59, 0.42 - halfVert);
  set(385, 0.61, 0.42 - halfVert);
  set(374, 0.59, 0.42 + halfVert);
  set(373, 0.61, 0.42 + halfVert);
  set(473, 0.60 + gazeOffset * 0.025, 0.42);

  // Face oval sample bounds
  set(10, 0.50, 0.25);
  set(152, 0.50, 0.78);

  return pts;
}

test('EAR and gaze are invariant across normalized [0..1] and pixel [960x540] landmarks', () => {
  const normPts = makeFaceLandmarks({ scaleX: 1, scaleY: 1, ear: 0.31, gazeOffset: 0.35 });
  const pxPts = makeFaceLandmarks({ scaleX: 960, scaleY: 540, ear: 0.31, gazeOffset: 0.35 });

  // Uniform pixel scale preserves Euclidean EAR exactly; isotropic webcam pixel coords also work directly
  const uniformPx = makeFaceLandmarks({ scaleX: 960, scaleY: 960, ear: 0.31, gazeOffset: 0.35 });
  assert.ok(Math.abs(computeMeanEar(normPts) - computeMeanEar(uniformPx)) < 1e-6);

  // Confirm 960x540 bounds stay within expected EAR & mirror gaze bounds
  const pxEar = computeMeanEar(pxPts);
  assert.ok(pxEar !== null && pxEar > 0.15 && pxEar < 0.5);

  const gNorm = computeGazeScalar(normPts, true);
  const gPx = computeGazeScalar(pxPts, true);
  assert.ok(Math.abs(gNorm - gPx) < 1e-6);
});

test('Blink fires on reopen (<650ms), coalesces <360ms bounces, and long-blink (>1100ms) never triggers blinkCut', () => {
  const proc = new SignalProcessor();

  const openPts = makeFaceLandmarks({ ear: 0.33 });
  const closedPts = makeFaceLandmarks({ ear: 0.12 });

  // Open eye baseline
  assert.equal(proc.process({ face: { landmarks: [{ value: openPts }] } }, 1000).blinkCut, false);

  // Close eyes at t=1100 -> must NOT cut prematurely on closing frame
  const closing = proc.process({ face: { landmarks: [{ value: closedPts }] } }, 1100);
  assert.equal(closing.blinkCut, false);
  assert.equal(closing.longBlinkPause, false);

  // Reopen at t=1280 (180ms blink) -> fires blinkCut on reopen
  const reopen = proc.process({ face: { landmarks: [{ value: openPts }] } }, 1280);
  assert.equal(reopen.blinkCut, true);
  assert.equal(reopen.longBlinkPause, false);

  // Rapid second bounce closing at 1340 and reopening at 1440 (<360ms after 1280) -> debounced
  proc.process({ face: { landmarks: [{ value: closedPts }] } }, 1340);
  const debounce = proc.process({ face: { landmarks: [{ value: openPts }] } }, 1440);
  assert.equal(debounce.blinkCut, false);

  // Deliberate long close (>=1100ms): close at 2000, hold past 3200, reopen at 3300 -> NO blinkCut at all
  assert.equal(proc.process({ face: { landmarks: [{ value: closedPts }] } }, 2000).blinkCut, false);
  const midHold = proc.process(
    {
      face: {
        landmarks: [{ value: closedPts }],
        blinking: [{ detected: true }],
      },
    },
    2500
  );
  assert.equal(midHold.blinkCut, false);
  const longHold = proc.process({ face: { landmarks: [{ value: closedPts }] } }, 3200);
  assert.equal(longHold.longBlinkPause, true);
  assert.equal(longHold.blinkCut, false);
  const afterLong = proc.process({ face: { landmarks: [{ value: openPts }] } }, 3350);
  assert.equal(afterLong.blinkCut, false);
  assert.equal(afterLong.longBlinkPause, false);
});

test('Native blinking pulse fires when landmarks are partial/absent unless closed >=400ms', () => {
  const proc = new SignalProcessor();
  // Partial blink (EAR stays open) + native SDK blink detection still triggers with 360ms debounce
  const openPts = makeFaceLandmarks({ ear: 0.28 });
  const hit1 = proc.process(
    {
      face: {
        landmarks: [{ value: openPts }],
        blinking: [{ detected: true }],
      },
    },
    1000
  );
  assert.equal(hit1.blinkCut, true);

  const debounced = proc.process(
    {
      face: {
        landmarks: [{ value: openPts }],
        blinking: [{ detected: true }],
      },
    },
    1200
  );
  assert.equal(debounced.blinkCut, false);
});

test('Coarse 3-zone gaze switches reliably across left, center, and right', () => {
  const proc = new SignalProcessor({ mirrorX: true, gazeAlpha: 0.8 });

  const lookLeft = makeFaceLandmarks({ gazeOffset: 0.9 });
  let res = proc.process({ face: { landmarks: [{ value: lookLeft }] } }, 1000);
  res = proc.process({ face: { landmarks: [{ value: lookLeft }] } }, 1050);
  assert.equal(res.gaze, 'left');

  const lookRight = makeFaceLandmarks({ gazeOffset: -0.9 });
  proc.process({ face: { landmarks: [{ value: lookRight }] } }, 1100);
  res = proc.process({ face: { landmarks: [{ value: lookRight }] } }, 1150);
  assert.equal(res.gaze, 'right');

  const lookCenter = makeFaceLandmarks({ gazeOffset: 0 });
  proc.process({ face: { landmarks: [{ value: lookCenter }] } }, 1200);
  res = proc.process({ face: { landmarks: [{ value: lookCenter }] } }, 1250);
  assert.equal(res.gaze, 'center');

  // Subtle natural laptop eye glance (~8% iris offset, gazeOffset=0.25) with default smoothing
  const naturalProc = new SignalProcessor({ mirrorX: true });
  const subtleLeft = makeFaceLandmarks({ gazeOffset: 0.25 });
  const subtleRight = makeFaceLandmarks({ gazeOffset: -0.25 });
  for (let i = 0; i < 6; i += 1) {
    res = naturalProc.process({ face: { landmarks: [{ value: subtleLeft }] } }, 2000 + i * 33);
  }
  assert.equal(res.gaze, 'left');
  for (let i = 0; i < 8; i += 1) {
    res = naturalProc.process({ face: { landmarks: [{ value: subtleRight }] } }, 2300 + i * 33);
  }
  assert.equal(res.gaze, 'right');
  for (let i = 0; i < 8; i += 1) {
    res = naturalProc.process({ face: { landmarks: [{ value: lookCenter }] } }, 2700 + i * 33);
  }
  assert.equal(res.gaze, 'center');
});

test('Linear detrending handles large upperTrace baseline drift without losing calm breath score or breathPhase', () => {
  const proc = new SignalProcessor();
  let lastRes;
  const phases = [];
  // Reproduce live spike drift (-6.8 .. +3.2) superposed on calm 0.25 Hz breathing
  for (let i = 0; i < 120; i += 1) {
    const t = i * 40;
    const sec = t / 1000;
    const drift = -2.2 * sec + 3.2;
    const val = Math.sin(sec * Math.PI * 2 * 0.25) * 1.4 + drift;
    lastRes = proc.process({ breathing: { upperTrace: [{ value: val }] } }, 1000 + t);
    if (sec >= 2.0) phases.push(lastRes.breathPhase);
  }
  assert.ok(lastRes.breathSteadiness >= 75, `expected >=75 despite drift, got ${lastRes.breathSteadiness}`);
  assert.equal(lastRes.breathWave.length, 36);
  assert.ok(Math.max(...phases) > 0.25 && Math.min(...phases) < -0.25, 'breathPhase should oscillate across inhale/exhale');
});

test('Pure linear posture slump without oscillation reads as flatline apnea, erratic jolts score low', () => {
  const slumpProc = new SignalProcessor();
  let slumpRes;
  for (let i = 0; i < 100; i += 1) {
    const t = i * 40;
    slumpRes = slumpProc.process({ breathing: { upperTrace: [{ value: -0.5 * (t / 1000) }] } }, 1000 + t);
  }
  assert.ok(slumpRes.breathSteadiness <= 30, `expected slump flatline <=30, got ${slumpRes.breathSteadiness}`);

  const erraticProc = new SignalProcessor();
  let erraticRes;
  for (let i = 0; i < 100; i += 1) {
    const t = i * 40;
    const val = (i % 2 === 0 ? 1 : -1) * (0.4 + ((i * 7) % 5) * 0.2);
    erraticRes = erraticProc.process({ breathing: { upperTrace: [{ value: val }] } }, 1000 + t);
  }
  assert.ok(erraticRes.breathSteadiness <= 40, `expected <=40, got ${erraticRes.breathSteadiness}`);
});

test('Talking speech-artifact guard ignores 2-frame stray flicker and engages after >=5 consecutive frames', () => {
  // Startup guard: even if talking=true arrives during warmup before first breath wave, initial 55 is replaced
  const startupProc = new SignalProcessor();
  let warm;
  for (let i = 0; i < 60; i += 1) {
    const t = i * 40;
    warm = startupProc.process(
      {
        face: { talking: [{ detected: true }] },
        breathing: { upperTrace: [{ value: Math.sin((t / 1000) * Math.PI * 2 * 0.2) }] },
      },
      1000 + t
    );
  }
  assert.equal(warm.talking, true);
  assert.ok(warm.breathSteadiness >= 75, `expected warmup breath >=75, got ${warm.breathSteadiness}`);

  const proc = new SignalProcessor();
  // Establish calm >=75 breathSteadiness
  let calm;
  for (let i = 0; i < 110; i += 1) {
    const t = i * 40;
    calm = proc.process({ breathing: { upperTrace: [{ value: Math.sin((t / 1000) * Math.PI * 2 * 0.2) }] } }, 1000 + t);
  }
  assert.ok(calm.breathSteadiness >= 75);

  // 2-frame stray mouth flicker must NOT set talking=true
  let flicker;
  for (let i = 110; i < 112; i += 1) {
    const t = i * 40;
    flicker = proc.process(
      {
        face: { talking: [{ detected: true }] },
        breathing: { upperTrace: [{ value: Math.sin((t / 1000) * Math.PI * 2 * 0.2) }] },
      },
      1000 + t
    );
  }
  assert.equal(flicker.talking, false);

  // >=5 consecutive talking frames engages talking=true and freezes established breathSteadiness across 900ms hold window
  let whileTalking;
  for (let i = 112; i < 118; i += 1) {
    const t = i * 40;
    whileTalking = proc.process(
      {
        face: { talking: [{ detected: true }] },
        breathing: { upperTrace: [{ value: Math.sin((t / 1000) * Math.PI * 2 * 0.2) }] },
      },
      1000 + t
    );
  }
  const lockedScore = whileTalking.breathSteadiness;
  assert.equal(whileTalking.talking, true);
  assert.ok(lockedScore >= 75, `expected calm locked score >=75, got ${lockedScore}`);

  // Inject chaotic erratic chest noise for ~720ms during talking hold: score stays frozen
  for (let i = 0; i < 16; i += 1) {
    const ts = 5720 + i * 45;
    whileTalking = proc.process(
      {
        face: { talking: [{ detected: false }] },
        breathing: { upperTrace: [{ value: i % 2 === 0 ? 3 : -3 }] },
      },
      ts
    );
  }
  assert.equal(whileTalking.talking, true);
  assert.equal(whileTalking.breathSteadiness, lockedScore);

  // After >900ms silence since last active streak (last onset ts=5680 -> >6580), talking clears
  const afterSilence = proc.process({ face: { talking: [{ detected: false }] } }, 6800);
  assert.equal(afterSilence.talking, false);
});

test('Expression calibration keeps resting SAD 80% neutral, triggers heavy only on sustained >=86%', () => {
  const proc = new SignalProcessor();
  let out;

  // Resting webcam SAD ~80% must stay neutral
  for (let i = 0; i < 40; i += 1) {
    out = proc.process(
      {
        face: {
          expression: [
            {
              scores: [
                { type: EXPR_SAD, confidence: 80 },
                { type: EXPR_NEUTRAL, confidence: 15 },
              ],
            },
          ],
        },
      },
      1000 + i * 40
    );
  }
  assert.equal(out.echo, 'neutral');

  // Sustained SAD 92% warms 0.90/0.10 EMA past >=86 -> heavy
  for (let i = 0; i < 45; i += 1) {
    out = proc.process(
      {
        face: {
          expression: [
            {
              scores: [
                { type: EXPR_SAD, confidence: 92 },
                { type: EXPR_NEUTRAL, confidence: 5 },
              ],
            },
          ],
        },
      },
      3000 + i * 40
    );
  }
  assert.equal(out.echo, 'heavy');

  // Sustained HAPPY 72% shifts to warm
  for (let i = 0; i < 25; i += 1) {
    out = proc.process(
      {
        face: {
          expression: [
            {
              scores: [
                { type: EXPR_HAPPY, confidence: 72 },
                { type: EXPR_NEUTRAL, confidence: 20 },
              ],
            },
          ],
        },
      },
      5000 + i * 40
    );
  }
  assert.equal(out.echo, 'warm');
});

test('Opt-in cardio pulseRate passes values only when confidence >= 40', () => {
  const proc = new SignalProcessor();

  const lowConf = proc.process(
    { cardio: { pulseRate: [{ value: 74.2, confidence: 28, stable: false }] } },
    1000
  );
  assert.equal(lowConf.pulseRate, null);
  assert.equal(lowConf.pulseConfidence, 28);
  assert.equal(lowConf.pulseStable, false);

  const highConf = proc.process(
    { cardio: { pulseRate: [{ value: 68.4, confidence: 74, stable: true }] } },
    2000
  );
  assert.equal(highConf.pulseRate, 68.4);
  assert.equal(highConf.pulseConfidence, 74);
  assert.equal(highConf.pulseStable, true);
});

test('Blink reopen cutoff: 649ms closure fires blinkCut while 650ms does not', () => {
  const openPts = makeFaceLandmarks({ ear: 0.32 });
  const closedPts = makeFaceLandmarks({ ear: 0.12 });

  const fastProc = new SignalProcessor();
  fastProc.process({ face: { landmarks: [{ value: openPts }] } }, 1000);
  fastProc.process({ face: { landmarks: [{ value: closedPts }] } }, 1100);
  assert.equal(fastProc.process({ face: { landmarks: [{ value: openPts }] } }, 1749).blinkCut, true);

  const slowProc = new SignalProcessor();
  slowProc.process({ face: { landmarks: [{ value: openPts }] } }, 1000);
  slowProc.process({ face: { landmarks: [{ value: closedPts }] } }, 1100);
  assert.equal(slowProc.process({ face: { landmarks: [{ value: openPts }] } }, 1750).blinkCut, false);
});

test('Long blink pause boundary: 1099ms does not pause, 1100ms fires once without re-firing', () => {
  const proc = new SignalProcessor();
  const closedPts = makeFaceLandmarks({ ear: 0.12 });

  assert.equal(proc.process({ face: { landmarks: [{ value: closedPts }] } }, 1000).longBlinkPause, false);
  assert.equal(proc.process({ face: { landmarks: [{ value: closedPts }] } }, 2099).longBlinkPause, false);
  assert.equal(proc.process({ face: { landmarks: [{ value: closedPts }] } }, 2100).longBlinkPause, true);
  assert.equal(proc.process({ face: { landmarks: [{ value: closedPts }] } }, 2400).longBlinkPause, false);
});

test('Gaze return hysteresis holds left/right through neutral deadband until return thresholds', () => {
  const proc = new SignalProcessor({ mirrorX: true, gazeAlpha: 1.0 });

  // Enter left (<0.455) then hold inside [0.455..0.478], exit only above 0.478
  assert.equal(proc.process({ face: { landmarks: [{ value: makeFaceLandmarks({ gazeOffset: 0.2 }) }] } }, 1000).gaze, 'left');
  const holdLeft = proc.process({ face: { landmarks: [{ value: makeFaceLandmarks({ gazeOffset: 0.09 }) }] } }, 1050);
  assert.ok(holdLeft.gazeScalar > 0.455 && holdLeft.gazeScalar < 0.478);
  assert.equal(holdLeft.gaze, 'left');
  assert.equal(proc.process({ face: { landmarks: [{ value: makeFaceLandmarks({ gazeOffset: 0.05 }) }] } }, 1100).gaze, 'center');

  // Enter right (>0.545) then hold inside [0.522..0.545], exit only below 0.522
  assert.equal(proc.process({ face: { landmarks: [{ value: makeFaceLandmarks({ gazeOffset: -0.2 }) }] } }, 1150).gaze, 'right');
  const holdRight = proc.process({ face: { landmarks: [{ value: makeFaceLandmarks({ gazeOffset: -0.08 }) }] } }, 1200);
  assert.ok(holdRight.gazeScalar > 0.522 && holdRight.gazeScalar < 0.545);
  assert.equal(holdRight.gaze, 'right');
  assert.equal(proc.process({ face: { landmarks: [{ value: makeFaceLandmarks({ gazeOffset: -0.05 }) }] } }, 1250).gaze, 'center');
});

test('mirrorX: false inverts horizontal gaze polarity relative to mirrorX: true', () => {
  const pts = makeFaceLandmarks({ gazeOffset: 0.4 });
  const mirrored = computeGazeScalar(pts, true);
  const unmirrored = computeGazeScalar(pts, false);
  assert.ok(mirrored !== null && unmirrored !== null);
  assert.ok(mirrored < 0.45 && unmirrored > 0.55);
  assert.ok(Math.abs(mirrored + unmirrored - 1) < 1e-6);
});

test('extractSilhouette normalizes 960x540 pixel coordinates strictly into [0..1] and guards short arrays', () => {
  assert.equal(extractSilhouette(null), null);
  assert.equal(extractSilhouette([{ x: 100, y: 100 }]), null);

  const pxPts = makeFaceLandmarks({ scaleX: 960, scaleY: 540 });
  const sil = extractSilhouette(pxPts);
  assert.equal(sil.length, 36);
  for (const pt of sil) {
    assert.ok(pt.x >= 0 && pt.x <= 1, `normalized x out of bounds: ${pt.x}`);
    assert.ok(pt.y >= 0 && pt.y <= 1, `normalized y out of bounds: ${pt.y}`);
  }
});

test('Rolling 4.5s breath window prunes stale history and recovers after a 5s face gap', () => {
  const proc = new SignalProcessor();
  // First jolt period (0..4.5s)
  for (let i = 0; i < 60; i += 1) {
    proc.process({ breathing: { upperTrace: [{ value: i % 2 === 0 ? 4 : -4 }] } }, 1000 + i * 50);
  }
  assert.ok(proc.breathSamples.length > 0 && proc.breathSamples.length <= 60);

  // Gap > 4.5s followed by clean sine wave should prune old jolts cleanly
  let res;
  for (let i = 0; i < 60; i += 1) {
    const t = 10000 + i * 50;
    res = proc.process(
      { breathing: { upperTrace: [{ value: Math.sin((t / 1000) * Math.PI * 2 * 0.25) }] } },
      t
    );
  }
  assert.equal(proc.breathSamples[0].ts >= 10000 - 4500 + 2950 - 4500, true);
  assert.ok(res.breathSamples === undefined && res.breathSteadiness >= 75, `expected recovery >=75, got ${res.breathSteadiness}`);
});

test('Breath rate & confidence rounding handle decimals and reject non-finite values', () => {
  const proc = new SignalProcessor();
  const valid = proc.process({ breathing: { rate: [{ value: 14.36, confidence: 82.6 }] } }, 1000);
  assert.equal(valid.breathRate, 14.4);
  assert.equal(valid.breathConfidence, 83);

  const invalid = proc.process({ breathing: { rate: [{ value: Number.NaN, confidence: 90 }] } }, 2000);
  assert.equal(invalid.breathRate, 14.4);
});

test('Opt-in cardio pulse rejects out-of-range rates (<=25 or >=240 bpm) even at high confidence', () => {
  const proc = new SignalProcessor();
  assert.equal(
    proc.process({ cardio: { pulseRate: [{ value: 25, confidence: 95, stable: true }] } }, 1000).pulseRate,
    null
  );
  assert.equal(
    proc.process({ cardio: { pulseRate: [{ value: 240, confidence: 95, stable: true }] } }, 2000).pulseRate,
    null
  );
  assert.equal(
    proc.process({ cardio: { pulseRate: [{ value: 62.34, confidence: 40, stable: false }] } }, 3000).pulseRate,
    62.3
  );
});

test('Expression hysteresis recovers both warm and heavy back to neutral', () => {
  const proc = new SignalProcessor();
  for (let i = 0; i < 25; i += 1) {
    proc.process({ face: { expression: [{ scores: [{ type: EXPR_HAPPY, confidence: 75 }] }] } }, 1000 + i * 40);
  }
  assert.equal(proc.echo, 'warm');

  let out;
  for (let i = 0; i < 25; i += 1) {
    out = proc.process(
      { face: { expression: [{ scores: [{ type: EXPR_NEUTRAL, confidence: 90 }, { type: EXPR_HAPPY, confidence: 0 }] }] } },
      2500 + i * 40
    );
  }
  assert.equal(out.echo, 'neutral');
});

test('reset() clears blink timers, breath buffer, talking streak, echo, pulse, and silhouette', () => {
  const proc = new SignalProcessor();
  const pts = makeFaceLandmarks({ ear: 0.31, gazeOffset: 0.5 });
  for (let i = 0; i < 40; i += 1) {
    proc.process(
      {
        face: {
          landmarks: [{ value: pts }],
          talking: [{ detected: true }],
          expression: [{ scores: [{ type: EXPR_HAPPY, confidence: 80 }] }],
        },
        breathing: { upperTrace: [{ value: Math.sin(i * 0.2) }], rate: [{ value: 15, confidence: 90 }] },
        cardio: { pulseRate: [{ value: 70, confidence: 85, stable: true }] },
      },
      1000 + i * 40
    );
  }
  proc.reset();
  const empty = proc.process({}, 5000);
  assert.equal(empty.gaze, 'center');
  assert.equal(empty.breathSteadiness, 55);
  assert.equal(empty.breathRate, null);
  assert.equal(empty.pulseRate, null);
  assert.equal(empty.talking, false);
  assert.equal(empty.echo, 'neutral');
  assert.equal(empty.silhouette, null);
});

test('Server privacy contract: enableTelemetry stays false, cardio defaults off, and requestInsight() is never called', () => {
  const serverPath = path.resolve(import.meta.dirname, 'server.mjs');
  const src = fs.readFileSync(serverPath, 'utf8');
  assert.match(src, /enableTelemetry:\s*false/);
  assert.match(src, /let activeEnableCardio = false;/);
  assert.ok(!src.includes('requestInsight('));
});
