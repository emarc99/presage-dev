import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BridgeStatus,
  GazeZone,
  LiveSignalPacket,
  SignalSource,
  TonalEcho,
} from '../types/signals';

const BRIDGE_HTTP = 'http://127.0.0.1:4199';
const BRIDGE_WS = 'ws://127.0.0.1:4199';

const DEFAULT_SIGNAL: LiveSignalPacket = {
  ts: Date.now(),
  fps: 0,
  faceDetected: false,
  blinkCut: false,
  longBlinkPause: false,
  gaze: 'center',
  gazeScalar: 0.5,
  breathSteadiness: 72,
  breathPhase: 0,
  breathRate: null,
  breathConfidence: 0,
  breathWave: [],
  talking: false,
  echo: 'neutral',
  pulseRate: null,
  pulseConfidence: 0,
  pulseStable: false,
  silhouette: null,
};

const DEFAULT_STATUS: BridgeStatus = {
  connected: false,
  sdkAvailable: false,
  apiKeyConfigured: false,
  enableCardio: false,
  recording: false,
  recordedCount: 0,
  state: 'idle',
  cameras: [],
  validation: 'unknown',
  validationHint: '',
  error: null,
  errorCode: null,
};

interface SampleTraceFrame {
  t: number;
  gaze: GazeZone;
  breathSteadiness: number;
  breathPhase?: number;
  breathRate: number | null;
  echo: TonalEcho;
  talking?: boolean;
  pulseRate?: number | null;
  blinkCut: boolean;
}

export function useSignals(onBlinkCut?: () => void) {
  const [source, setSource] = useState<SignalSource>('sample');
  const [bridgeAvailable, setBridgeAvailable] = useState<boolean | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>(DEFAULT_STATUS);
  const [signal, setSignal] = useState<LiveSignalPacket>(DEFAULT_SIGNAL);
  const [paused, setPaused] = useState(false);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const wsRef = useRef<WebSocket | null>(null);
  const didAutoSelectRef = useRef(false);
  const pendingStartRef = useRef<{ cameraId?: string; enableCardio: boolean } | null>(null);
  const lastSignalCommitMsRef = useRef(0);
  const lastDiscreteRef = useRef<{
    faceDetected: boolean;
    gaze: GazeZone;
    talking: boolean;
    echo: TonalEcho;
  }>({
    faceDetected: false,
    gaze: 'center',
    talking: false,
    echo: 'neutral',
  });
  const onBlinkRef = useRef(onBlinkCut);
  onBlinkRef.current = onBlinkCut;

  // Probe local Node bridge once on startup to see if running natively
  const probeBridge = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 900);
      const res = await fetch(`${BRIDGE_HTTP}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const apiKeyConfigured = Boolean(data.apiKeyConfigured);
        const sdkAvailable = Boolean(data.sdkAvailable);
        setBridgeAvailable(true);
        setBridgeStatus((prev) => ({
          ...prev,
          sdkAvailable,
          apiKeyConfigured,
          enableCardio: Boolean(data.enableCardio),
          recording: Boolean(data.recording),
          state: typeof data.state === 'string' ? data.state : prev.state,
        }));
        if (!didAutoSelectRef.current && data.ok && sdkAvailable && apiKeyConfigured) {
          didAutoSelectRef.current = true;
          setSource((prev) => (prev === 'sample' || prev === 'keyboard' ? 'bridge' : prev));
        }
        return true;
      }
    } catch {
      // bridge offline (e.g. hosted static on Vercel)
    }
    setBridgeAvailable(false);
    return false;
  }, []);

  useEffect(() => {
    void probeBridge();
  }, [probeBridge]);

  // Connect WebSocket when user selects 'bridge' mode (auto-reconnects cleanly on bridge restart)
  useEffect(() => {
    if (source !== 'bridge') {
      pendingStartRef.current = null;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let closed = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(BRIDGE_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) return;
        setBridgeAvailable(true);
        setBridgeStatus((prev) => ({ ...prev, connected: true, error: null }));
        if (pendingStartRef.current) {
          const queued = pendingStartRef.current;
          pendingStartRef.current = null;
          ws.send(
            JSON.stringify({
              type: 'start',
              cameraId: queued.cameraId || null,
              enableCardio: queued.enableCardio,
            })
          );
        }
      };

      ws.onmessage = (ev) => {
        if (closed) return;
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === 'status') {
            setBridgeStatus({
              connected: true,
              sdkAvailable: Boolean(msg.sdkAvailable),
              apiKeyConfigured: Boolean(msg.apiKeyConfigured),
              enableCardio: Boolean(msg.enableCardio),
              recording: Boolean(msg.recording),
              recordedCount: Number(msg.recordedCount ?? 0),
              state: msg.state || 'idle',
              cameras: msg.cameras || [],
              validation: msg.validation || 'unknown',
              validationHint: msg.validationHint || '',
              error: msg.error || null,
              errorCode: msg.errorCode || null,
            });
          } else if (msg.type === 'signal') {
            if (msg.longBlinkPause) {
              setPaused((p) => !p);
            }
            if (msg.blinkCut) {
              onBlinkRef.current?.();
            }

            const nextFace = Boolean(msg.faceDetected);
            const nextGaze: GazeZone = msg.gaze || 'center';
            const nextTalking = Boolean(msg.talking);
            const nextEcho: TonalEcho = msg.echo || 'neutral';
            const prevD = lastDiscreteRef.current;
            const discreteChanged =
              Boolean(msg.blinkCut) ||
              Boolean(msg.longBlinkPause) ||
              nextFace !== prevD.faceDetected ||
              nextGaze !== prevD.gaze ||
              nextTalking !== prevD.talking ||
              nextEcho !== prevD.echo;

            const nowPerf = performance.now();
            if (!discreteChanged && nowPerf - lastSignalCommitMsRef.current < 80) {
              return;
            }
            lastSignalCommitMsRef.current = nowPerf;
            lastDiscreteRef.current = {
              faceDetected: nextFace,
              gaze: nextGaze,
              talking: nextTalking,
              echo: nextEcho,
            };

            setSignal({
              ts: msg.ts ?? Date.now(),
              fps: msg.fps ?? 0,
              faceDetected: nextFace,
              blinkCut: Boolean(msg.blinkCut),
              longBlinkPause: Boolean(msg.longBlinkPause),
              gaze: nextGaze,
              gazeScalar: typeof msg.gazeScalar === 'number' ? msg.gazeScalar : 0.5,
              breathSteadiness:
                typeof msg.breathSteadiness === 'number' ? msg.breathSteadiness : 55,
              breathPhase: typeof msg.breathPhase === 'number' ? msg.breathPhase : 0,
              breathRate: msg.breathRate ?? null,
              breathConfidence: msg.breathConfidence ?? 0,
              breathWave: Array.isArray(msg.breathWave) ? msg.breathWave : [],
              talking: nextTalking,
              echo: nextEcho,
              pulseRate: typeof msg.pulseRate === 'number' ? msg.pulseRate : null,
              pulseConfidence: typeof msg.pulseConfidence === 'number' ? msg.pulseConfidence : 0,
              pulseStable: Boolean(msg.pulseStable),
              silhouette: Array.isArray(msg.silhouette) ? msg.silhouette : null,
            });
          }
        } catch {
          // ignore malformed packets
        }
      };

      ws.onerror = () => {
        if (closed) return;
        setBridgeStatus((prev) => ({
          ...prev,
          connected: false,
          error: 'Local SmartSpectra bridge not running on 127.0.0.1:4199',
        }));
      };

      ws.onclose = () => {
        if (closed) return;
        setBridgeStatus((prev) => ({ ...prev, connected: false, state: 'idle' }));
        if (wsRef.current === ws) wsRef.current = null;
        if (reconnectTimer === null) {
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 1500);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [source]);

  // Sample Trace Playback Mode (for Vercel judges without webcam/bridge)
  useEffect(() => {
    if (source !== 'sample') return;
    let cancelled = false;
    let timerId: number | null = null;

    fetch('/sample-trace.json')
      .then((r) => r.json())
      .then((trace: { frames: SampleTraceFrame[] }) => {
        if (cancelled || !Array.isArray(trace.frames) || trace.frames.length === 0) return;
        let idx = 0;
        const step = () => {
          if (cancelled) return;
          let nextDelayMs = 500;
          if (!pausedRef.current) {
            const f = trace.frames[idx];
            const nextIdx = (idx + 1) % trace.frames.length;
            const nextFrame = trace.frames[nextIdx];
            if (nextIdx > idx && nextFrame) {
              nextDelayMs = Math.min(
                1800,
                Math.max(180, Math.round((nextFrame.t - f.t) * 1000))
              );
            }
            const phase = idx * 0.65;
            const wave = Array.from({ length: 36 }, (_, wi) =>
              Number(
                Math.sin(wi * 0.38 + phase) *
                  (0.45 + (f.breathSteadiness / 100) * 0.45)
              )
            );
            const syntheticPhase =
              typeof f.breathPhase === 'number' ? f.breathPhase : Number(Math.sin(phase).toFixed(3));
            if (f.blinkCut) onBlinkRef.current?.();
            setSignal((prev) => ({
              ...prev,
              ts: Date.now(),
              fps: 28,
              faceDetected: true,
              blinkCut: f.blinkCut,
              gaze: f.gaze,
              gazeScalar: f.gaze === 'left' ? 0.28 : f.gaze === 'right' ? 0.72 : 0.5,
              breathSteadiness: f.breathSteadiness,
              breathPhase: syntheticPhase,
              breathRate: f.breathRate,
              breathConfidence: 84,
              breathWave: wave,
              talking: Boolean(f.talking),
              echo: f.echo,
              pulseRate: typeof f.pulseRate === 'number' ? f.pulseRate : null,
              pulseConfidence: typeof f.pulseRate === 'number' ? 72 : 0,
              pulseStable: typeof f.pulseRate === 'number',
            }));
            idx = nextIdx;
          }
          timerId = window.setTimeout(step, nextDelayMs);
        };
        step();
      })
      .catch(() => {
        // fallback cleanly
      });

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [source]);

  const startLiveBridge = useCallback((cameraId?: string, enableCardio = false) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      pendingStartRef.current = null;
      ws.send(
        JSON.stringify({
          type: 'start',
          cameraId: cameraId || null,
          enableCardio: Boolean(enableCardio),
        })
      );
    } else {
      pendingStartRef.current = { cameraId, enableCardio: Boolean(enableCardio) };
    }
  }, []);

  const stopLiveBridge = useCallback(() => {
    pendingStartRef.current = null;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }));
    }
  }, []);

  const startRecording = useCallback((filename?: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'record_start', filename }));
    }
  }, []);

  const stopRecording = useCallback((saveAsSample = false) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'record_stop', saveAsSample }));
    }
  }, []);

  const manualBlink = useCallback(() => {
    setSignal((prev) => ({ ...prev, ts: Date.now(), blinkCut: true }));
    onBlinkRef.current?.();
  }, []);

  const manualGaze = useCallback((gaze: GazeZone) => {
    setSignal((prev) => ({
      ...prev,
      ts: Date.now(),
      gaze,
      gazeScalar: gaze === 'left' ? 0.25 : gaze === 'right' ? 0.75 : 0.5,
    }));
  }, []);

  const manualBreath = useCallback((val: number) => {
    const clamped = Math.min(100, Math.max(10, Math.round(val)));
    const jitter = (1 - clamped / 100) * 0.4;
    const wave = Array.from({ length: 36 }, (_, i) =>
      Number((Math.sin(i * 0.42) * 0.8 + Math.sin(i * 1.9) * jitter).toFixed(3))
    );
    setSignal((prev) => ({
      ...prev,
      ts: Date.now(),
      breathSteadiness: clamped,
      breathWave: wave,
    }));
  }, []);

  const manualEcho = useCallback((echo: TonalEcho) => {
    setSignal((prev) => ({ ...prev, ts: Date.now(), echo }));
  }, []);

  return {
    source,
    setSource,
    bridgeAvailable,
    bridgeStatus,
    probeBridge,
    signal,
    paused,
    setPaused,
    startLiveBridge,
    stopLiveBridge,
    startRecording,
    stopRecording,
    manualBlink,
    manualGaze,
    manualBreath,
    manualEcho,
  };
}
