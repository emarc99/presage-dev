import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  SmartSpectraSDK,
  CameraSelection,
  faceMetrics,
  breathingMetrics,
  cardioMetrics,
  SmartSpectraErrorCode,
  ValidationCode,
  ProcessingStatus,
} from '@smartspectra/node-sdk';
import { decodeMetrics } from '@smartspectra/node-sdk/messages';
import { SignalProcessor } from './signal-processor.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'web', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

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
    port: Number(process.env.PORT) || 4199,
    noCamera: false,
    file: null,
    record: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--port' && argv[i + 1]) {
      const p = Number(argv[++i]);
      if (Number.isInteger(p) && p > 0 && p < 65536) opts.port = p;
    } else if (a === '--no-camera') {
      opts.noCamera = true;
    } else if (a === '--file' && argv[i + 1]) {
      opts.file = argv[++i];
    } else if (a === '--record' && argv[i + 1]) {
      opts.record = argv[++i];
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

function getApiKey() {
  const raw = (
    process.env.SMARTSPECTRA_API_KEY ||
    process.env.PRESAGE_API_KEY ||
    process.env.PRESAGE_SMARTSPECTRA_API_KEY ||
    ''
  ).trim();
  if (!raw || raw === 'your_presage_api_key_here') return '';
  return raw;
}

function listCamerasSafe() {
  try {
    return SmartSpectraSDK.availableCameras().map((c) => ({
      id: c.id,
      name: c.name,
      facing: c.facing,
      lensType: c.lensType,
    }));
  } catch {
    return [];
  }
}

function resolveStaticFile(reqUrl) {
  const cleanPath = (reqUrl || '/').split('?')[0];
  let rel = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const full = path.resolve(DIST_DIR, rel);
  if (!full.startsWith(DIST_DIR)) return null;
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  // SPA route fallback when extension-less
  if (!path.extname(rel)) {
    const fallback = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(fallback)) return fallback;
  }
  return null;
}

async function main() {
  loadEnvFile(path.join(ROOT_DIR, '.env'));
  const opts = parseArgs(process.argv.slice(2));
  const processor = new SignalProcessor({ mirrorX: true });

  let sdk = null;
  let activeState = 'idle'; // idle | starting | running | stopping | error
  let latestValidation = 'unknown';
  let latestHint = '';
  let lastError = null;
  let lastErrorCode = null;
  let retryCount = 0;
  let activeSourceConfig = null;
  let activeEnableCardio = false;
  let disconnectTimer = null;

  // Serialized async mutex prevents start/stop races across route switches & transient errors
  let opQueue = Promise.resolve();
  function enqueueOp(fn) {
    const run = opQueue.then(fn, fn);
    opQueue = run.catch(() => {});
    return run;
  }

  // Optional JSONL signal recorder + 2Hz sample-trace extractor
  let recordStream = null;
  let recordPath = null;
  let recordStartedAt = 0;
  let recordedCount = 0;
  let lastSampleEmitMs = -Infinity;
  let sampleFrames = [];

  function startRecording(targetFile) {
    if (recordStream) return recordPath;
    const recDir = path.join(ROOT_DIR, 'recordings');
    const safeName = targetFile
      ? path.basename(String(targetFile)).replace(/[^a-zA-Z0-9._-]/g, '_')
      : `sitting-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
    const resolved =
      opts.record && !targetFile
        ? path.resolve(opts.record)
        : path.join(recDir, safeName.endsWith('.jsonl') ? safeName : `${safeName}.jsonl`);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    recordStream = fs.createWriteStream(resolved, { flags: 'a' });
    recordPath = resolved;
    recordStartedAt = Date.now();
    recordedCount = 0;
    lastSampleEmitMs = -Infinity;
    sampleFrames = [];
    console.log(`[bridge] Recording signal frames to ${recordPath}`);
    return recordPath;
  }

  async function stopRecording(saveAsSample = false) {
    if (!recordStream) {
      return { path: null, count: 0, sampleSaved: false };
    }
    const stream = recordStream;
    const outPath = recordPath;
    const count = recordedCount;
    const capturedSamples = sampleFrames.slice();
    recordStream = null;
    recordPath = null;
    recordStartedAt = 0;
    recordedCount = 0;
    sampleFrames = [];
    await new Promise((resolve) => stream.end(resolve));

    let sampleSaved = false;
    if (saveAsSample && capturedSamples.length >= 4) {
      const sampleOut = path.join(ROOT_DIR, 'web', 'public', 'sample-trace.json');
      const payload = {
        kind: 'recorded_sitting',
        note: `Recorded live SmartSpectra sitting (${capturedSamples.length} keyframes from Windows webcam bridge).`,
        fps: 2,
        frames: capturedSamples,
      };
      fs.writeFileSync(sampleOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      sampleSaved = true;
      console.log(`[bridge] Saved ${capturedSamples.length} keyframes to ${sampleOut}`);
    }
    return { path: outPath, count, sampleSaved };
  }

  if (opts.record) {
    startRecording();
  }

  // 1s FPS meter
  let packetsInWindow = 0;
  let currentFps = 0;
  const fpsTimer = setInterval(() => {
    currentFps = packetsInWindow;
    packetsInWindow = 0;
  }, 1000);

  const clients = new Set();

  function broadcast(payload) {
    const encoded = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === 1) {
        ws.send(encoded);
      }
    }
  }

  function buildStatusPayload() {
    return {
      type: 'status',
      state: activeState,
      cameras: listCamerasSafe(),
      apiKeyConfigured: Boolean(getApiKey()),
      sdkAvailable: true,
      enableCardio: activeEnableCardio,
      recording: Boolean(recordStream),
      recordedCount,
      validation: latestValidation,
      validationHint: latestHint,
      error: lastError,
      errorCode: lastErrorCode,
    };
  }

  async function _stopCaptureInner(reason = 'stopped') {
    if (!sdk) {
      activeState = 'idle';
      activeSourceConfig = null;
      activeEnableCardio = false;
      broadcast(buildStatusPayload());
      return;
    }
    const current = sdk;
    sdk = null;
    activeSourceConfig = null;
    activeEnableCardio = false;
    activeState = 'stopping';
    broadcast(buildStatusPayload());
    try {
      await current.stopAsync();
      if (typeof current.destroy === 'function') {
        await current.destroy();
      }
    } catch (err) {
      console.error(`[bridge] stopCapture (${reason}) warning:`, err?.message || err);
    }
    activeState = 'idle';
    latestValidation = 'unknown';
    latestHint = '';
    processor.reset();
    broadcast(buildStatusPayload());
  }

  function stopCapture(reason = 'stopped') {
    return enqueueOp(() => _stopCaptureInner(reason));
  }

  async function _startCaptureInner(config = {}) {
    if (opts.noCamera) {
      lastError = 'Bridge running with --no-camera';
      lastErrorCode = 'kInputUnavailable';
      activeState = 'error';
      broadcast(buildStatusPayload());
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      lastError = 'SMARTSPECTRA_API_KEY is missing in .env';
      lastErrorCode = 'kAuthenticationFailed';
      activeState = 'error';
      broadcast(buildStatusPayload());
      return;
    }

    const nextConfig = {
      cameraId: config.cameraId || null,
      filePath: config.filePath || opts.file || null,
      enableCardio: Boolean(config.enableCardio),
    };

    // Warm stream reuse: avoid tearing down active DirectShow/MediaFoundation handle when
    // transitioning /calibrate -> /experience with identical camera/file/cardio config.
    const isWarm = sdk && (activeState === 'starting' || activeState === 'running');
    const sameConfig =
      activeSourceConfig &&
      activeSourceConfig.cameraId === nextConfig.cameraId &&
      activeSourceConfig.filePath === nextConfig.filePath &&
      activeSourceConfig.enableCardio === nextConfig.enableCardio;
    if (isWarm && sameConfig) {
      broadcast(buildStatusPayload());
      return;
    }

    await _stopCaptureInner('restart');
    lastError = null;
    lastErrorCode = null;
    activeSourceConfig = nextConfig;
    activeEnableCardio = nextConfig.enableCardio;
    activeState = 'starting';
    processor.reset();
    broadcast(buildStatusPayload());

    // cardioMetrics is strictly opt-in (OFF by default). Presage SDK Privacy Policy §7.4
    // notes automatic Presage -> Anthropic LLM Insights processing on cloud cardio requests.
    const requestedMetrics = nextConfig.enableCardio
      ? [...faceMetrics, ...breathingMetrics, ...cardioMetrics]
      : [...faceMetrics, ...breathingMetrics];

    const instance = new SmartSpectraSDK({
      apiKey,
      requestedMetrics,
      enableTelemetry: false,
    });
    sdk = instance;

    const filePath = nextConfig.filePath;
    if (filePath) {
      instance.useFile(path.resolve(filePath), { interframeDelayMs: 33 });
    } else {
      const selection = nextConfig.cameraId
        ? CameraSelection.byId(nextConfig.cameraId)
        : CameraSelection.default;
      instance.useCamera(selection, { width: 960, height: 540, fps: 30 });
    }

    instance.on('processingStatus', (code) => {
      const name = STATUS_NAMES.get(code) || String(code);
      if (code === ProcessingStatus.kRunning) {
        activeState = 'running';
        retryCount = 0;
      } else if (code === ProcessingStatus.kStarting) {
        activeState = 'starting';
      } else if (code === ProcessingStatus.kIdle && sdk === instance && activeState === 'running') {
        activeState = 'idle';
      } else if (name === 'kError') {
        activeState = 'error';
      }
      broadcast(buildStatusPayload());
    });

    instance.on('validationStatus', (code, _ts, hint) => {
      latestValidation = VALIDATION_NAMES.get(code) || String(code);
      latestHint = hint || '';
      broadcast(buildStatusPayload());
    });

    instance.on('error', async (code, message, retryable) => {
      const errName = ERROR_NAMES.get(code) || `code_${code}`;
      console.error(`[bridge] SDK error ${errName} (${code}) retryable=${retryable}: ${message}`);
      const transient =
        code === SmartSpectraErrorCode.kNetworkError ||
        code === SmartSpectraErrorCode.kProcessingFailed;
      if (transient && retryCount < 2 && clients.size > 0 && sdk === instance) {
        retryCount += 1;
        const recoverCfg = activeSourceConfig ? { ...activeSourceConfig } : {};
        console.log(`[bridge] Transient error recovery attempt ${retryCount}/2...`);
        await stopCapture('auto-recover');
        setTimeout(() => {
          if (clients.size > 0) startCapture(recoverCfg);
        }, 1200);
        return;
      }
      lastErrorCode = errName;
      lastError = message || errName;
      activeState = 'error';
      await stopCapture('error');
    });

    instance.on('metrics', (buf) => {
      packetsInWindow += 1;
      let decoded;
      try {
        decoded = decodeMetrics(buf);
      } catch (err) {
        return;
      }
      const nowMs = Date.now();
      const out = processor.process(decoded, nowMs);
      const signalMsg = {
        type: 'signal',
        fps: currentFps,
        ...out,
      };
      if (recordStream) {
        const { silhouette: _omitSilhouette, ...compact } = out;
        recordStream.write(`${JSON.stringify({ t: Number(((nowMs - recordStartedAt) / 1000).toFixed(2)), fps: currentFps, ...compact })}\n`);
        recordedCount += 1;
        if (out.blinkCut || nowMs - lastSampleEmitMs >= 500) {
          lastSampleEmitMs = nowMs;
          sampleFrames.push({
            t: Number(((nowMs - recordStartedAt) / 1000).toFixed(2)),
            gaze: out.gaze,
            breathSteadiness: out.breathSteadiness,
            breathPhase: out.breathPhase,
            breathRate: out.breathRate,
            echo: out.echo,
            talking: out.talking,
            pulseRate: out.pulseRate,
            blinkCut: out.blinkCut,
          });
        }
      }
      broadcast(signalMsg);
    });

    instance.start();
  }

  function startCapture(config = {}) {
    return enqueueOp(() => _startCaptureInner(config));
  }

  const server = http.createServer((req, res) => {
    const reqOrigin = req.headers.origin || '';
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(reqOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', reqOrigin);
      res.setHeader('Vary', 'Origin');
    }

    if (req.url?.startsWith('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: true,
          sdkAvailable: true,
          apiKeyConfigured: Boolean(getApiKey()),
          state: activeState,
          enableCardio: activeEnableCardio,
          recording: Boolean(recordStream),
          camerasCount: listCamerasSafe().length,
        })
      );
      return;
    }

    if (fs.existsSync(DIST_DIR)) {
      const filePath = resolveStaticFile(req.url);
      if (filePath) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      '<!doctype html><html><body style="font-family:sans-serif;padding:32px">' +
        '<h2>AFTERIMAGE SmartSpectra Bridge Running</h2>' +
        '<p>WebSocket endpoint active on this port. Build <code>web/</code> (<code>npm run build</code>) or run Vite dev server.</p>' +
        '</body></html>'
    );
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    ws.send(JSON.stringify(buildStatusPayload()));

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg?.type === 'list_cameras') {
        ws.send(JSON.stringify(buildStatusPayload()));
      } else if (msg?.type === 'start') {
        retryCount = 0;
        await startCapture({
          cameraId: msg.cameraId || null,
          filePath: msg.filePath || null,
          enableCardio: Boolean(msg.enableCardio),
        });
      } else if (msg?.type === 'stop') {
        await stopCapture('client_stop');
      } else if (msg?.type === 'record_start') {
        const outPath = startRecording(msg.filename);
        ws.send(JSON.stringify({ type: 'ack', action: 'record_start', ok: true, path: outPath }));
        broadcast(buildStatusPayload());
      } else if (msg?.type === 'record_stop') {
        const summary = await stopRecording(Boolean(msg.saveAsSample));
        ws.send(JSON.stringify({ type: 'ack', action: 'record_stop', ok: true, ...summary }));
        broadcast(buildStatusPayload());
      } else if (msg?.type === 'record_export') {
        ws.send(JSON.stringify({ type: 'ack', action: 'record_export', ok: true }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      if (clients.size === 0 && sdk) {
        disconnectTimer = setTimeout(() => {
          if (clients.size === 0) stopCapture('clients_disconnected');
        }, 3000);
      }
    });
  });

  async function cleanExit() {
    clearInterval(fpsTimer);
    if (disconnectTimer) clearTimeout(disconnectTimer);
    await stopRecording(false);
    await stopCapture('shutdown');
    wss.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  }

  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);

  server.listen(opts.port, '127.0.0.1', () => {
    console.log(`AFTERIMAGE Bridge listening on http://127.0.0.1:${opts.port}`);
    console.log(`API key configured: ${Boolean(getApiKey())} | web/dist present: ${fs.existsSync(DIST_DIR)}`);
  });
}

main().catch((err) => {
  console.error('[bridge] Fatal error:', err?.stack || err);
  process.exit(1);
});
