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
    }
  ) => void;
  markCompleted: () => void;
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
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [soundMuted, setSoundMuted] = useState(false);

  const [report, setReport] = useState<SessionReport>(() => ({
    startedAt: new Date().toISOString(),
    completed: false,
    source: signals.source,
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
              }
            : rec
        );
        return { ...prev, source: signals.source, records: nextRecords };
      });
    },
    [signals.source]
  );

  const markCompleted = useCallback(() => {
    setReport((prev) => ({ ...prev, completed: true, source: signals.source }));
  }, [signals.source]);

  const eraseSession = useCallback(() => {
    signals.stopLiveBridge();
    setReport({
      startedAt: new Date().toISOString(),
      completed: false,
      source: signals.source,
      records: createInitialRecords(),
    });
  }, [signals]);

  const value = useMemo<SessionContextValue>(
    () => ({
      theme,
      setTheme,
      activeMeta,
      themes,
      signals,
      consented,
      setConsented,
      selectedCameraId,
      setSelectedCameraId,
      soundMuted,
      toggleSound,
      report,
      registerBlinkHandler,
      commitSceneStats,
      markCompleted,
      eraseSession,
    }),
    [
      theme,
      setTheme,
      activeMeta,
      themes,
      signals,
      consented,
      selectedCameraId,
      soundMuted,
      toggleSound,
      report,
      registerBlinkHandler,
      commitSceneStats,
      markCompleted,
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
