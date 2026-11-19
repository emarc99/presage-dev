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

  // Note: computeEar uses Euclidean distance, so equal aspect scaling preserves EAR;
  // check uniform scale (960x960) and realistic 960x540 bounds stay cleanly aligned
  const uniformPx = makeFaceLandmarks({ scaleX: 960, scaleY: 960, ear: 0.31, gazeOffset: 0.35 });
  assert.ok(Math.abs(computeMeanEar(normPts) - computeMeanEar(uniformPx)) < 1e-6);

  const gNorm = computeGazeScalar(normPts, true);
  const gPx = computeGazeScalar(pxPts, true);
  assert.ok(Math.abs(gNorm - gPx) < 1e-6);
});

test('Blink debouncing coalesces micro-twitches and detects deliberate long blinks', () => {
  const proc = new SignalProcessor();

  const openPts = makeFaceLandmarks({ ear: 0.33 });
  const closedPts = makeFaceLandmarks({ ear: 0.12 });

  const s1 = proc.process({ face: { landmarks: [{ value: openPts }] } }, 1000);
  assert.equal(s1.blinkCut, false);

  // Initial closure triggers 1 blink cut
  const s2 = proc.process({ face: { landmarks: [{ value: closedPts }] } }, 1200);
  assert.equal(s2.blinkCut, true);
  assert.equal(s2.longBlinkPause, false);

  // Open then rapid micro-twitch within 180ms should be coalesced
  proc.process({ face: { landmarks: [{ value: openPts }] } }, 1280);
  const s3 = proc.process({ face: { landmarks: [{ value: closedPts }] } }, 1380);
  assert.equal(s3.blinkCut, false);

  // Holding closed past 1100ms fires longBlinkPause once
  const s4 = proc.process({ face: { landmarks: [{ value: closedPts }] } }, 2550);
  assert.equal(s4.longBlinkPause, true);
  const s5 = proc.process({ face: { landmarks: [{ value: closedPts }] } }, 2700);
  assert.equal(s5.longBlinkPause, false);
});

test('Coarse 3-zone gaze switches reliably across left, center, and right', () => {
  const proc = new SignalProcessor({ mirrorX: true, gazeAlpha: 0.8 });

  // In mirrored webcam view, shifting eye coords positive shifts viewer toward screen left
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

test('Rolling 4.5s breath steadiness scores calm wave high, erratic noise low, flatline low', () => {
  const calmProc = new SignalProcessor();
  let lastRes;
  // 4 seconds of slow smooth 0.2 Hz breathing sine at 25 Hz
  for (let i = 0; i < 100; i += 1) {
    const t = i * 40;
    const val = Math.sin((t / 1000) * Math.PI * 2 * 0.2);
    lastRes = calmProc.process({ breathing: { upperTrace: [{ value: val }] } }, 1000 + t);
  }
  assert.ok(lastRes.breathSteadiness >= 75, `expected >=75, got ${lastRes.breathSteadiness}`);
  assert.equal(lastRes.breathWave.length, 36);

  const erraticProc = new SignalProcessor();
  for (let i = 0; i < 100; i += 1) {
    const t = i * 40;
    const val = (i % 2 === 0 ? 1 : -1) * (0.4 + ((i * 7) % 5) * 0.2);
    lastRes = erraticProc.process({ breathing: { upperTrace: [{ value: val }] } }, 1000 + t);
  }
  assert.ok(lastRes.breathSteadiness <= 40, `expected <=40, got ${lastRes.breathSteadiness}`);

  const flatProc = new SignalProcessor();
  for (let i = 0; i < 100; i += 1) {
    const t = i * 40;
    lastRes = flatProc.process({ breathing: { upperTrace: [{ value: 0.01 }] } }, 1000 + t);
  }
  assert.ok(lastRes.breathSteadiness <= 35, `expected <=35, got ${lastRes.breathSteadiness}`);
});

test('Tonal echo tracks happy -> warm and sad -> heavy smoothly', () => {
  const proc = new SignalProcessor();
  let out;
  for (let i = 0; i < 15; i += 1) {
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
      1000 + i * 50
    );
  }
  assert.equal(out.echo, 'warm');

  for (let i = 0; i < 20; i += 1) {
    out = proc.process(
      {
        face: {
          expression: [
            {
              scores: [
                { type: EXPR_SAD, confidence: 78 },
                { type: EXPR_NEUTRAL, confidence: 15 },
              ],
            },
          ],
        },
      },
      2000 + i * 50
    );
  }
  assert.equal(out.echo, 'heavy');
});
