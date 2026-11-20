import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SignalProcessor,
  computeMeanEar,
  computeGazeScalar,
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

test('Talking speech-artifact guard holds breathSteadiness steady for 1200ms bridge window', () => {
  const proc = new SignalProcessor();
  // First establish calm ~85 breathSteadiness
  let calm;
  for (let i = 0; i < 110; i += 1) {
    const t = i * 40;
    calm = proc.process({ breathing: { upperTrace: [{ value: Math.sin((t / 1000) * Math.PI * 2 * 0.2) }] } }, 1000 + t);
  }
  assert.ok(calm.breathSteadiness >= 75);
  const frozenScore = calm.breathSteadiness;

  // Speak + inject chaotic erratic chest noise for 900ms: score stays frozen and talking=true
  let whileTalking;
  for (let i = 0; i < 20; i += 1) {
    const t = 5500 + i * 45;
    whileTalking = proc.process(
      {
        face: { talking: [{ detected: i < 5 }] },
        breathing: { upperTrace: [{ value: (i % 2 === 0 ? 3 : -3) }] },
      },
      t
    );
  }
  assert.equal(whileTalking.talking, true);
  assert.equal(whileTalking.breathSteadiness, frozenScore);

  // After >1200ms silence since last detected=true (t=5680 -> >6880), talking clears
  const afterSilence = proc.process({ face: { talking: [{ detected: false }] } }, 7100);
  assert.equal(afterSilence.talking, false);
});

test('Expression calibration keeps resting SAD 75% neutral, triggers heavy only on sustained >=78%', () => {
  const proc = new SignalProcessor();
  let out;

  // Resting webcam SAD ~75% must stay neutral (observed in live Windows capture)
  for (let i = 0; i < 35; i += 1) {
    out = proc.process(
      {
        face: {
          expression: [
            {
              scores: [
                { type: EXPR_SAD, confidence: 75 },
                { type: EXPR_NEUTRAL, confidence: 20 },
              ],
            },
          ],
        },
      },
      1000 + i * 40
    );
  }
  assert.equal(out.echo, 'neutral');

  // Sustained SAD 88% eventually warms EMA past >=78 -> heavy
  for (let i = 0; i < 40; i += 1) {
    out = proc.process(
      {
        face: {
          expression: [
            {
              scores: [
                { type: EXPR_SAD, confidence: 88 },
                { type: EXPR_NEUTRAL, confidence: 8 },
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
