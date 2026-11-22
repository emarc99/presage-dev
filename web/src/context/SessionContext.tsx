import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { SCENES } from '../data/scenes';
import { useSignals } from '../hooks/useSignals';
import { useTheme } from '../hooks/useTheme';
import { soundscape } from '../audio/soundscape';
import type { SceneRecord, SessionReport, TonalEcho } from '../types/signals';

function createInitialRecords(): SceneRecord[] {
  return SCENES.map((sc, idx) => ({
    sceneIndex: idx,
    roman: sc.roman,
    title: sc.title,
    holdSeconds: 0,
    blinkCuts: 0,
    avgBreathSteadiness: 0,
    breathRibbon: [],
    gazeCounts: { left: 0, center: 0, right: 0 },
    dominantEcho: 'neutral',
    unlockedHiddenCount: 0,
  }));
}

interface SessionContextValue {
  theme: ReturnType<typeof useTheme>['theme'];
  setTheme: ReturnType<typeof useTheme>['setTheme'];
  activeMeta: ReturnType<typeof useTheme>['activeMeta'];
  themes: ReturnType<typeof useTheme>['themes'];
  signals: ReturnType<typeof useSignals>;
  consented: boolean;
  setConsented: (v: boolean) => void;
  enableCardio: boolean;
  setEnableCardio: (v: boolean) => void;
  selectedCameraId: string;
  setSelectedCameraId: (id: string) => void;
  soundMuted: boolean;
  toggleSound: () => void;
  report: SessionReport;
  registerBlinkHandler: (fn: (() => void) | null) => void;
  commitSceneStats: (
    sceneIdx: number,
    delta: {
      holdSeconds: number;
      blinkCuts: number;
      avgSteadiness: number;
      breathRibbon: number[];
      gazeCounts: { left: number; center: number; right: number };
      dominantEcho: TonalEcho;
      unlockedHiddenCount: number;
      avgPulseBpm?: number | null;
    }
  ) => void;
  markCompleted: () => void;
  resetSittingMetrics: () => void;
  eraseSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, activeMeta, themes } = useTheme();
  const blinkHandlerRef = useRef<(() => void) | null>(null);

  const registerBlinkHandler = useCallback((fn: (() => void) | null) => {
    blinkHandlerRef.current = fn;
  }, []);

  const signals = useSignals(() => {
    blinkHandlerRef.current?.();
  });

  const [consented, setConsented] = useState(true);
  // Strictly opt-in (OFF by default) so pulse/HRV are never computed or buffered unless chosen; §7.4 auto-fired summaries are disclosed on /calibrate
  const [enableCardio, setEnableCardio] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [soundMuted, setSoundMuted] = useState(false);

  const [report, setReport] = useState<SessionReport>(() => ({
    startedAt: new Date().toISOString(),
    completed: false,
    source: signals.source,
    enableCardio: false,
    records: createInitialRecords(),
  }));

  const toggleSound = useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev;
      if (!next) soundscape.ensureStarted();
      soundscape.setMuted(next);
      return next;
    });
  }, []);

  const commitSceneStats = useCallback(
    (
      sceneIdx: number,
      delta: {
        holdSeconds: number;
        blinkCuts: number;
        avgSteadiness: number;
        breathRibbon: number[];
        gazeCounts: { left: number; center: number; right: number };
        dominantEcho: TonalEcho;
        unlockedHiddenCount: number;
        avgPulseBpm?: number | null;
      }
    ) => {
      setReport((prev) => {
        const nextRecords = prev.records.map((rec) =>
          rec.sceneIndex === sceneIdx
            ? {
                ...rec,
                holdSeconds: delta.holdSeconds,
                blinkCuts: delta.blinkCuts,
                avgBreathSteadiness: delta.avgSteadiness,
                breathRibbon: delta.breathRibbon,
                gazeCounts: delta.gazeCounts,
                dominantEcho: delta.dominantEcho,
                unlockedHiddenCount: delta.unlockedHiddenCount,
                avgPulseBpm: delta.avgPulseBpm ?? rec.avgPulseBpm ?? null,
              }
            : rec
        );
        return { ...prev, source: signals.source, enableCardio, records: nextRecords };
      });
    },
    [signals.source, enableCardio]
  );

  const markCompleted = useCallback(() => {
    setReport((prev) => ({ ...prev, completed: true, source: signals.source, enableCardio }));
  }, [signals.source, enableCardio]);

  // Resets session metrics while preserving a warm camera stream when transitioning /calibrate -> /experience
  const resetSittingMetrics = useCallback(() => {
    setReport({
      startedAt: new Date().toISOString(),
      completed: false,
      source: signals.source,
      enableCardio,
      records: createInitialRecords(),
    });
  }, [signals.source, enableCardio]);

  const eraseSession = useCallback(() => {
    signals.stopLiveBridge();
    setReport({
      startedAt: new Date().toISOString(),
      completed: false,
      source: signals.source,
      enableCardio,
      records: createInitialRecords(),
    });
  }, [signals, enableCardio]);

  const value = useMemo<SessionContextValue>(
    () => ({
      theme,
      setTheme,
      activeMeta,
      themes,
      signals,
      consented,
      setConsented,
      enableCardio,
      setEnableCardio,
      selectedCameraId,
      setSelectedCameraId,
      soundMuted,
      toggleSound,
      report,
      registerBlinkHandler,
      commitSceneStats,
      markCompleted,
      resetSittingMetrics,
      eraseSession,
    }),
    [
      theme,
      setTheme,
      activeMeta,
      themes,
      signals,
      consented,
      enableCardio,
      selectedCameraId,
      soundMuted,
      toggleSound,
      report,
      registerBlinkHandler,
      commitSceneStats,
      markCompleted,
      resetSittingMetrics,
      eraseSession,
    ]
  );

  return (
    <SessionContext.Provider value={value}>
      <div id="app-root" className={`${activeMeta.cssClass} min-h-screen flex flex-col`}>
        {children}
      </div>
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
