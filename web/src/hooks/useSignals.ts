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
  breathRate: null,
  breathConfidence: 0,
  breathWave: [],
  echo: 'neutral',
  silhouette: null,
};

const DEFAULT_STATUS: BridgeStatus = {
  connected: false,
  sdkAvailable: false,
  apiKeyConfigured: false,
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
  breathRate: number | null;
  echo: TonalEcho;
  blinkCut: boolean;
}

export function useSignals(onBlinkCut?: () => void) {
  const [source, setSource] = useState<SignalSource>('keyboard');
  const [bridgeAvailable, setBridgeAvailable] = useState<boolean | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>(DEFAULT_STATUS);
  const [signal, setSignal] = useState<LiveSignalPacket>(DEFAULT_SIGNAL);
  const [paused, setPaused] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
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
        setBridgeAvailable(true);
        setBridgeStatus((prev) => ({
          ...prev,
          sdkAvailable: Boolean(data.sdkAvailable),
          apiKeyConfigured: Boolean(data.apiKeyConfigured),
        }));
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

  // Connect WebSocket when user selects 'bridge' mode
  useEffect(() => {
    if (source !== 'bridge') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let closed = false;
    const ws = new WebSocket(BRIDGE_WS);
    wsRef.current = ws;

    ws.onopen = () => {
      if (closed) return;
      setBridgeAvailable(true);
      setBridgeStatus((prev) => ({ ...prev, connected: true, error: null }));
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
          setSignal({
            ts: msg.ts ?? Date.now(),
            fps: msg.fps ?? 0,
            faceDetected: Boolean(msg.faceDetected),
            blinkCut: Boolean(msg.blinkCut),
            longBlinkPause: Boolean(msg.longBlinkPause),
            gaze: msg.gaze || 'center',
            gazeScalar: typeof msg.gazeScalar === 'number' ? msg.gazeScalar : 0.5,
            breathSteadiness:
              typeof msg.breathSteadiness === 'number' ? msg.breathSteadiness : 55,
            breathRate: msg.breathRate ?? null,
            breathConfidence: msg.breathConfidence ?? 0,
            breathWave: Array.isArray(msg.breathWave) ? msg.breathWave : [],
            echo: msg.echo || 'neutral',
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
    };

    return () => {
      closed = true;
      ws.close();
      wsRef.current = null;
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
          if (!paused) {
            const f = trace.frames[idx];
            const phase = idx * 0.65;
            const wave = Array.from({ length: 36 }, (_, wi) =>
              Number(
                Math.sin(wi * 0.38 + phase) *
                  (0.45 + (f.breathSteadiness / 100) * 0.45)
              )
            );
            if (f.blinkCut) onBlinkRef.current?.();
            setSignal((prev) => ({
              ...prev,
              ts: Date.now(),
              fps: 28,
              faceDetected: true,
              blinkCut: f.blinkCut,
              gaze: f.gaze,
              breathSteadiness: f.breathSteadiness,
              breathRate: f.breathRate,
              breathConfidence: 84,
              breathWave: wave,
              echo: f.echo,
            }));
            idx = (idx + 1) % trace.frames.length;
          }
          timerId = window.setTimeout(step, 1800);
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
  }, [source, paused]);

  const startLiveBridge = useCallback((cameraId?: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'start', cameraId: cameraId || null }));
    }
  }, []);

  const stopLiveBridge = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }));
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
    manualBlink,
    manualGaze,
    manualBreath,
    manualEcho,
  };
}
