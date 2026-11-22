import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const tracePath = path.join(ROOT, 'web', 'public', 'sample-trace.json');
const serverPath = path.join(ROOT, 'bridge', 'server.mjs');
const calibratePath = path.join(ROOT, 'web', 'src', 'pages', 'CalibratePage.tsx');

const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
assert.equal(trace.kind, 'recorded_sitting', 'sample trace kind must be recorded_sitting');
assert.ok(Array.isArray(trace.frames), 'sample trace must contain frames array');
assert.equal(trace.frames.length, 366, 'expected 366 recorded keyframes');

const frames = trace.frames;
const firstT = frames[0].t;
const lastT = frames[frames.length - 1].t;
const span = Number((lastT - firstT).toFixed(2));
assert.equal(firstT, 11.33);
assert.equal(lastT, 213.28);
assert.equal(span, 201.95);

const gazeCounts = { left: 0, center: 0, right: 0 };
const echoCounts = { neutral: 0, warm: 0, heavy: 0 };
let breathRateCount = 0;
let steadinessSum = 0;
let minStead = Infinity;
let maxStead = -Infinity;
let ge60 = 0;
let talkingCount = 0;
let rawBlinks = 0;

// Reproduce the ExperiencePage 4.2s Shutter Armed dwell gate over the recorded trace timestamps
const SHUTTER_ARM_SEC = 4.2;
let lastCutT = firstT;
let armedCuts = 0;
let suppressedEarly = 0;

for (const f of frames) {
  gazeCounts[f.gaze] = (gazeCounts[f.gaze] || 0) + 1;
  echoCounts[f.echo] = (echoCounts[f.echo] || 0) + 1;
  if (typeof f.breathRate === 'number') breathRateCount += 1;
  steadinessSum += f.breathSteadiness;
  if (f.breathSteadiness < minStead) minStead = f.breathSteadiness;
  if (f.breathSteadiness > maxStead) maxStead = f.breathSteadiness;
  if (f.breathSteadiness >= 60) ge60 += 1;
  if (f.talking) talkingCount += 1;
  if (f.blinkCut) {
    rawBlinks += 1;
    if (f.t - lastCutT >= SHUTTER_ARM_SEC) {
      armedCuts += 1;
      lastCutT = f.t;
    } else {
      suppressedEarly += 1;
    }
  }
}

const avgStead = Number((steadinessSum / frames.length).toFixed(1));
const pctGe60 = Number(((100 * ge60) / frames.length).toFixed(1));

assert.deepEqual(gazeCounts, { left: 91, center: 235, right: 40 });
assert.deepEqual(echoCounts, { neutral: 182, warm: 0, heavy: 184 });
assert.equal(breathRateCount, 308);
assert.equal(minStead, 37);
assert.equal(maxStead, 85);
assert.equal(avgStead, 63.9);
assert.equal(ge60, 233);
assert.equal(pctGe60, 63.7);
assert.equal(talkingCount, 0);
assert.equal(rawBlinks, 26);
assert.equal(armedCuts, 15);
assert.equal(suppressedEarly, 11);

// Verify SDK privacy invariants in bridge/server.mjs & UI copy consistency
const serverSrc = fs.readFileSync(serverPath, 'utf8');
assert.match(serverSrc, /enableTelemetry:\s*false/, 'bridge/server.mjs must disable SDK telemetry');
assert.match(serverSrc, /let activeEnableCardio = false;/, 'cardioMetrics must default OFF');
assert.ok(!serverSrc.includes('requestInsight('), 'bridge must never call requestInsight()');

const calibrateSrc = fs.readFileSync(calibratePath, 'utf8');
assert.ok(
  !calibrateSrc.includes('avoids automatic\n') && !calibrateSrc.includes('No Anthropic §7.4 cloud Insights'),
  'CalibratePage must not claim leaving cardio off disables Presage §7.4 auto-fired breathing summaries'
);

console.log('AFTERIMAGE trace & privacy verification passed:');
console.log(
  JSON.stringify(
    {
      kind: trace.kind,
      frames: frames.length,
      timeRange: [firstT, lastT],
      spanSeconds: span,
      gazeCounts,
      echoCounts,
      breathRateCount,
      breathSteadiness: { min: minStead, max: maxStead, avg: avgStead, ge60, pctGe60 },
      talkingCount,
      blinks: { raw: rawBlinks, armedCuts, suppressedEarly },
    },
    null,
    2
  )
);
