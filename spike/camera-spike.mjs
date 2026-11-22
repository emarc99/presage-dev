import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SmartSpectraSDK,
  CameraSelection,
  faceMetrics,
  breathingMetrics,
  SmartSpectraErrorCode,
  ValidationCode,
  ProcessingStatus,
} from '@smartspectra/node-sdk';
import { decodeMetrics, presage } from '@smartspectra/node-sdk/messages';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function parseArgs(argv) {
  const opts = {
    list: false,
    skipReadiness: false,
    cameraId: null,
    file: null,
    seconds: 20,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list') {
      opts.list = true;
    } else if (arg === '--skip-readiness') {
      opts.skipReadiness = true;
    } else if (arg === '--camera-id' && argv[i + 1]) {
      opts.cameraId = argv[++i];
    } else if (arg === '--file' && argv[i + 1]) {
      opts.file = argv[++i];
    } else if (arg === '--seconds' && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (Number.isFinite(parsed) && parsed > 0) opts.seconds = parsed;
    }
  }
  return opts;
}

function makeReverseMap(enumObj) {
  const rev = new Map();
  for (const [k, v] of Object.entries(enumObj || {})) {
    if (typeof v === 'number' && !rev.has(v)) rev.set(v, k);
  }
  return rev;
}

const VALIDATION_NAMES = makeReverseMap(ValidationCode);
const ERROR_NAMES = makeReverseMap(SmartSpectraErrorCode);
const STATUS_NAMES = makeReverseMap(ProcessingStatus);
const EXPRESSION_NAMES = makeReverseMap(presage?.smartspectra?.ExpressionType);

function listCameras() {
  const cams = SmartSpectraSDK.availableCameras();
  console.log(`Available cameras (${cams.length}):`);
  for (const cam of cams) {
    console.log(
      `  - name=${JSON.stringify(cam.name)} id=${JSON.stringify(cam.id)} facing=${cam.facing} lens=${cam.lensType}`
    );
  }
  return cams;
}

async function main() {
  loadEnvFile(path.join(ROOT_DIR, '.env'));
  const opts = parseArgs(process.argv.slice(2));

  if (opts.list) {
    listCameras();
    return;
  }

  const apiKey = (
    process.env.SMARTSPECTRA_API_KEY ||
    process.env.PRESAGE_API_KEY ||
    process.env.PRESAGE_SMARTSPECTRA_API_KEY ||
    ''
  ).trim();

  if (!apiKey || apiKey === 'your_presage_api_key_here') {
    console.log('Missing SMARTSPECTRA_API_KEY.');
    console.log('1. Copy .env.example to .env and paste your Presage API key.');
    console.log('2. Re-run: npm run spike');
    process.exitCode = 1;
    return;
  }

  const cameras = listCameras();
  if (!opts.file && cameras.length === 0) {
    console.error('No cameras reported by SmartSpectraSDK.availableCameras().');
    process.exitCode = 1;
    return;
  }

  // Request faceMetrics + breathingMetrics ONLY (cardioMetrics stays OFF so pulse/HRV are
  // never computed or buffered; §7.4 auto-fired summaries for active metrics are disclosed).
  const requestedMetrics = [...faceMetrics, ...breathingMetrics];
  const sdk = new SmartSpectraSDK({
    apiKey,
    requestedMetrics,
    enableTelemetry: false,
  });

  if (opts.file) {
    const resolved = path.resolve(opts.file);
    console.log(`Source: file (${resolved})`);
    sdk.useFile(resolved, { interframeDelayMs: 33 });
  } else {
    const selection = opts.cameraId
      ? CameraSelection.byId(opts.cameraId)
      : CameraSelection.default;
    // Windows native capture rejects CameraSelection.front/.back with kInputUnavailable.
    // 960x540 keeps CPU/USB load safe against kSustainedLowFrameRate (14).
    console.log(
      `Source: camera (${opts.cameraId ? `byId(${opts.cameraId})` : 'CameraSelection.default'}) at 960x540@30fps`
    );
    sdk.useCamera(selection, { width: 960, height: 540, fps: 30 });
  }

  if (!opts.skipReadiness) {
    console.log('Running checkDeviceReadiness()...');
    const readiness = await sdk.checkDeviceReadiness();
    console.log('Readiness:', JSON.stringify(readiness));
  } else {
    console.log('Skipping checkDeviceReadiness() (--skip-readiness).');
  }

  // Rolling 1-second diagnostic bucket
  let packetCount = 0;
  let lastValidation = 'unknown';
  let landmarkCount = 0;
  let lmXMin = Infinity;
  let lmXMax = -Infinity;
  let lmYMin = Infinity;
  let lmYMax = -Infinity;
  let blinkDetected = 0;
  let talkingSamples = 0;
  let talkingTrue = 0;
  let topExpr = '-';
  let upperCount = 0;
  let upperMin = Infinity;
  let upperMax = -Infinity;
  let upperAnyStable = false;
  let latestBreathRate = null;
  let finished = false;

  sdk.on('processingStatus', (status) => {
    const name = STATUS_NAMES.get(status) || String(status);
    console.log(`[status] ${name}`);
  });

  sdk.on('validationStatus', (code, _ts, hint) => {
    const name = VALIDATION_NAMES.get(code) || String(code);
    lastValidation = hint ? `${name} (${hint})` : name;
  });

  sdk.on('error', (code, message, retryable) => {
    const name = ERROR_NAMES.get(code) || `code_${code}`;
    console.error(`[error] ${name} (${code}) retryable=${retryable}: ${message}`);
  });

  sdk.on('metrics', (buf) => {
    packetCount += 1;
    let m;
    try {
      m = decodeMetrics(buf);
    } catch (err) {
      console.error('[decodeMetrics error]', err?.message || err);
      return;
    }

    const lms = m.face?.landmarks || [];
    for (const lm of lms) {
      const pts = lm.value || [];
      landmarkCount = pts.length;
      for (let i = 0; i < pts.length; i += 1) {
        const { x, y } = pts[i];
        if (typeof x === 'number') {
          if (x < lmXMin) lmXMin = x;
          if (x > lmXMax) lmXMax = x;
        }
        if (typeof y === 'number') {
          if (y < lmYMin) lmYMin = y;
          if (y > lmYMax) lmYMax = y;
        }
      }
    }

    for (const b of m.face?.blinking || []) {
      if (b.detected) blinkDetected += 1;
    }

    for (const t of m.face?.talking || []) {
      talkingSamples += 1;
      if (t.detected) talkingTrue += 1;
    }

    const exps = m.face?.expression || [];
    if (exps.length > 0) {
      const scores = exps[exps.length - 1].scores || [];
      let best = null;
      for (const s of scores) {
        if (!best || (s.confidence ?? 0) > (best.confidence ?? 0)) best = s;
      }
      if (best) {
        const ename = EXPRESSION_NAMES.get(best.type) || String(best.type);
        topExpr = `${ename}:${(best.confidence ?? 0).toFixed(1)}%`;
      }
    }

    for (const u of m.breathing?.upperTrace || []) {
      upperCount += 1;
      if (typeof u.value === 'number') {
        if (u.value < upperMin) upperMin = u.value;
        if (u.value > upperMax) upperMax = u.value;
      }
      if (u.stable) upperAnyStable = true;
    }

    const rates = m.breathing?.rate || [];
    if (rates.length > 0) {
      const last = rates[rates.length - 1];
      latestBreathRate = {
        value: Number(last.value?.toFixed?.(2) ?? last.value),
        confidence: last.confidence,
        stable: Boolean(last.stable),
      };
    }
  });

  const reporter = setInterval(() => {
    const xRange =
      lmXMin <= lmXMax ? `[${lmXMin.toFixed(1)}..${lmXMax.toFixed(1)}]` : 'n/a';
    const yRange =
      lmYMin <= lmYMax ? `[${lmYMin.toFixed(1)}..${lmYMax.toFixed(1)}]` : 'n/a';
    const uRange =
      upperMin <= upperMax
        ? `[${upperMin.toFixed(3)}..${upperMax.toFixed(3)}]`
        : 'n/a';
    const brStr = latestBreathRate
      ? `${latestBreathRate.value} BrPM (conf=${latestBreathRate.confidence}, stable=${latestBreathRate.stable})`
      : 'warming-up';

    console.log(
      `[1s] ${packetCount} Hz | val=${lastValidation} | lm=${landmarkCount} x=${xRange} y=${yRange} | blinks=${blinkDetected} | talk=${talkingTrue}/${talkingSamples} | expr=${topExpr} | upper=${upperCount} ${uRange} stable=${upperAnyStable} | br=${brStr}`
    );

    packetCount = 0;
    lmXMin = Infinity;
    lmXMax = -Infinity;
    lmYMin = Infinity;
    lmYMax = -Infinity;
    blinkDetected = 0;
    talkingSamples = 0;
    talkingTrue = 0;
    upperCount = 0;
    upperMin = Infinity;
    upperMax = -Infinity;
    upperAnyStable = false;
  }, 1000);

  async function shutdown(reason) {
    if (finished) return;
    finished = true;
    clearInterval(reporter);
    console.log(`\nStopping (${reason})...`);
    try {
      await sdk.stopAsync();
      if (typeof sdk.destroy === 'function') {
        await sdk.destroy();
      }
      console.log('SDK stopped cleanly.');
    } catch (err) {
      console.error('stopAsync/destroy error:', err?.message || err);
    }
  }

  process.on('SIGINT', async () => {
    await shutdown('SIGINT');
    process.exit(0);
  });

  console.log(`Starting measurement for ${opts.seconds}s (face + breathing only)...`);
  sdk.start();

  setTimeout(async () => {
    await shutdown(`${opts.seconds}s complete`);
    process.exit(0);
  }, opts.seconds * 1000);
}

main().catch((err) => {
  console.error('Fatal spike error:', err?.stack || err);
  process.exitCode = 1;
});
