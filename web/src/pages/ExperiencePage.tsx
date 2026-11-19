import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundscape } from '../audio/soundscape';
import { SceneArt } from '../components/SceneArt';
import { SCENES } from '../data/scenes';
import { useSession } from '../context/SessionContext';
import type { GazeZone, TonalEcho } from '../types/signals';

const HIDDEN_UNLOCK_THRESHOLD = 60;

export function ExperiencePage() {
  const navigate = useNavigate();
  const {
    signals,
    soundMuted,
    toggleSound,
    registerBlinkHandler,
    commitSceneStats,
    markCompleted,
  } = useSession();

  const [sceneIdx, setSceneIdx] = useState(0);
  const [beatIdx, setBeatIdx] = useState(0);
  const [shutterCount, setShutterCount] = useState(0);
  const [showSignalsDrawer, setShowSignalsDrawer] = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);

  const scene = SCENES[sceneIdx];
  const beat = scene.beats[beatIdx];
  const { signal, paused, setPaused } = signals;

  const statsRef = useRef({
    sceneIdx: 0,
    startedAtMs: Date.now(),
    blinkCuts: 0,
    steadinessSum: 0,
    steadinessSamples: 0,
    latestWave: [] as number[],
    gazeCounts: { left: 0, center: 0, right: 0 },
    echoCounts: { neutral: 0, warm: 0, heavy: 0 } as Record<TonalEcho, number>,
    unlockedBeats: new Set<number>(),
  });

  const flushSceneStats = useCallback(
    (targetIdx: number) => {
      const st = statsRef.current;
      const holdSeconds = Number(Math.max(0.5, (Date.now() - st.startedAtMs) / 1000).toFixed(1));
      const avgSteadiness =
        st.steadinessSamples > 0
          ? Math.round(st.steadinessSum / st.steadinessSamples)
          : signal.breathSteadiness;

      let dominantEcho: TonalEcho = 'neutral';
      if (st.echoCounts.warm > st.echoCounts.neutral && st.echoCounts.warm >= st.echoCounts.heavy) {
        dominantEcho = 'warm';
      } else if (
        st.echoCounts.heavy > st.echoCounts.neutral &&
        st.echoCounts.heavy > st.echoCounts.warm
      ) {
        dominantEcho = 'heavy';
      }

      commitSceneStats(targetIdx, {
        holdSeconds,
        blinkCuts: st.blinkCuts,
        avgSteadiness,
        breathRibbon: st.latestWave.length > 0 ? st.latestWave : signal.breathWave,
        gazeCounts: { ...st.gazeCounts },
        dominantEcho,
        unlockedHiddenCount: st.unlockedBeats.size,
      });
    },
    [commitSceneStats, signal.breathSteadiness, signal.breathWave]
  );

  const resetSceneAccumulator = useCallback((nextIdx: number) => {
    statsRef.current = {
      sceneIdx: nextIdx,
      startedAtMs: Date.now(),
      blinkCuts: 0,
      steadinessSum: 0,
      steadinessSamples: 0,
      latestWave: [],
      gazeCounts: { left: 0, center: 0, right: 0 },
      echoCounts: { neutral: 0, warm: 0, heavy: 0 },
      unlockedBeats: new Set<number>(),
    };
  }, []);

  const advanceOnBlink = useCallback(() => {
    soundscape.ensureStarted(SCENES[sceneIdx].baseHz);
    soundscape.playShutterClick();
    setShutterCount((c) => c + 1);
    statsRef.current.blinkCuts += 1;

    if (beatIdx < 2) {
      setBeatIdx((b) => b + 1);
      return;
    }

    flushSceneStats(sceneIdx);

    if (sceneIdx < SCENES.length - 1) {
      const nextScene = sceneIdx + 1;
      resetSceneAccumulator(nextScene);
      setSceneIdx(nextScene);
      setBeatIdx(0);
    } else {
      markCompleted();
      signals.stopLiveBridge();
      navigate('/contact-sheet');
    }
  }, [beatIdx, flushSceneStats, markCompleted, navigate, resetSceneAccumulator, sceneIdx, signals]);

  // Bind live blink handler from SmartSpectra / Sample Trace / Manual trigger
  useEffect(() => {
    registerBlinkHandler(advanceOnBlink);
    return () => registerBlinkHandler(null);
  }, [advanceOnBlink, registerBlinkHandler]);

  // Flush partial scene stats cleanly if user leaves page via navbar
  useEffect(() => {
    const currentIdx = sceneIdx;
    return () => {
      flushSceneStats(currentIdx);
    };
  }, [flushSceneStats, sceneIdx]);

  // Accumulate breath/gaze/echo samples on every signal tick
  useEffect(() => {
    const st = statsRef.current;
    st.steadinessSum += signal.breathSteadiness;
    st.steadinessSamples += 1;
    if (signal.breathWave.length > 0) {
      st.latestWave = signal.breathWave;
    }
    st.gazeCounts[signal.gaze] += 1;
    st.echoCounts[signal.echo] += 1;
    if (signal.breathSteadiness >= HIDDEN_UNLOCK_THRESHOLD) {
      st.unlockedBeats.add(beatIdx);
    }
  }, [beatIdx, signal]);

  // Update procedural soundscape
  useEffect(() => {
    soundscape.setSceneTone(scene.baseHz);
  }, [scene.baseHz]);

  useEffect(() => {
    soundscape.update(signal.breathSteadiness, signal.echo, signal.gaze);
  }, [signal.breathSteadiness, signal.echo, signal.gaze]);

  // Smooth drift loop slowed by calm breathing
  useEffect(() => {
    let rafId = 0;
    const step = () => {
      if (!paused) {
        const speed = 1.15 - (signal.breathSteadiness / 100) * 0.85;
        setParallaxOffset((prev) => (prev + 0.32 * speed) % 240);
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [paused, signal.breathSteadiness]);

  // Keyboard shortcuts (Space = Blink Cut, Arrows = Gaze, Shift hold = Steady breath)
  useEffect(() => {
    let shiftInterval: number | null = null;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        ev.preventDefault();
        signals.manualBlink();
      } else if (ev.key === 'ArrowLeft') {
        signals.manualGaze('left');
      } else if (ev.key === 'ArrowUp') {
        signals.manualGaze('center');
      } else if (ev.key === 'ArrowRight') {
        signals.manualGaze('right');
      } else if (ev.key === 'Shift' && shiftInterval === null) {
        shiftInterval = window.setInterval(() => {
          signals.manualBreath(Math.min(96, signal.breathSteadiness + 5));
        }, 120);
      }
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === 'Shift' && shiftInterval !== null) {
        window.clearInterval(shiftInterval);
        shiftInterval = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      if (shiftInterval !== null) window.clearInterval(shiftInterval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [signal.breathSteadiness, signals]);

  const driftMultiplier = (1.15 - (signal.breathSteadiness / 100) * 0.85).toFixed(2);
  const hiddenUnlocked = signal.breathSteadiness >= HIDDEN_UNLOCK_THRESHOLD;

  const handleFinishEarly = () => {
    flushSceneStats(sceneIdx);
    markCompleted();
    signals.stopLiveBridge();
    navigate('/contact-sheet');
  };

  return (
    <main className="flex-1 flex flex-col justify-between max-w-6xl w-full mx-auto px-6 py-8 gap-5">
      {/* Minimal Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span
            className="font-mono-tab text-xs uppercase tracking-widest"
            style={{ color: 'var(--pop)' }}
          >
            Scene {scene.roman} of V · {scene.title}
          </span>
          <h1 className="font-serif-ed text-2xl font-normal m-0 mt-0.5">
            {scene.subtitle} · Beat {beatIdx + 1}/3
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono-tab text-xs px-3 py-1.5 rounded-full font-semibold"
            style={{ background: 'var(--pop-soft)', color: 'var(--pop)' }}
          >
            {hiddenUnlocked ? 'FOCUS SHARP' : signal.breathSteadiness >= 40 ? 'DEVELOPING' : 'HAZY'}{' '}
            · {signal.breathSteadiness}%
          </span>

          <button
            type="button"
            onClick={toggleSound}
            className="font-mono-tab text-xs px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              color: 'var(--ink-muted)',
            }}
          >
            {soundMuted ? 'Sound: Off' : 'Sound: On'}
          </button>

          <button
            type="button"
            onClick={() => setShowSignalsDrawer((v) => !v)}
            className="font-mono-tab text-xs px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              color: 'var(--ink-muted)',
            }}
          >
            Signals Info
          </button>
        </div>
      </div>

      {/* Collapsible Diagnostics Bar (for judges) */}
      {showSignalsDrawer && (
        <div
          className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono-tab"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <span>
            SOURCE:{' '}
            {signals.source === 'bridge'
              ? `Live SmartSpectra (${signal.fps} Hz · ${signals.bridgeStatus.validation})`
              : signals.source === 'sample'
              ? 'Recorded Sample Replay'
              : 'Keyboard Preview (Space = Blink · ←/↑/→ = Gaze)'}
          </span>
          <span>
            GAZE: <strong className="uppercase">{signal.gaze}</strong>
          </span>
          <span>
            DRIFT: <strong style={{ color: 'var(--pop2)' }}>{driftMultiplier}×</strong>
          </span>
          <span>
            CHEST RATE:{' '}
            <strong>
              {signal.breathRate !== null ? `${signal.breathRate} BrPM (${signal.breathConfidence}%)` : 'warming-up'}
            </strong>
          </span>
          <span>
            ECHO: <strong className="uppercase">{signal.echo}</strong>
          </span>
        </div>
      )}

      {/* Scene Roll Progress Pips */}
      <div className="flex items-center gap-2">
        {SCENES.map((s, idx) => (
          <div
            key={s.id}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{
              background:
                idx < sceneIdx
                  ? 'var(--pop)'
                  : idx === sceneIdx
                  ? 'var(--pop2)'
                  : 'var(--line)',
            }}
          />
        ))}
      </div>

      {/* Interactive Layered SVG Stage */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--line)', background: 'var(--scene-sky-top)' }}
      >
        <SceneArt
          sceneIndex={sceneIdx}
          gaze={signal.gaze}
          breathSteadiness={signal.breathSteadiness}
          echo={signal.echo}
          parallaxOffset={parallaxOffset}
        />

        {/* Focus Gaze Tag inside Top Corner */}
        <div className="pointer-events-none absolute top-3 left-4 right-4 flex items-center justify-between gap-2 text-xs font-mono-tab">
          <span
            className="px-2.5 py-1 rounded-full"
            style={{
              background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
            }}
          >
            FOCUS: {scene.zoneLabels[signal.gaze]}
          </span>
          {paused && (
            <span
              className="px-2.5 py-1 rounded-full font-semibold"
              style={{ background: 'var(--pop2)', color: 'var(--pop-contrast)' }}
            >
              PAUSED (LONG BLINK)
            </span>
          )}
        </div>

        {/* Eyelid Shutter Wipe keyed on shutterCount */}
        {shutterCount > 0 && (
          <div
            key={shutterCount}
            className="pointer-events-none absolute inset-0 origin-center scale-y-0 opacity-0 shutter-fire"
            style={{ background: '#050507' }}
          />
        )}

        {/* Story Prose & Developed Hidden Marginalia */}
        <div
          className="px-6 py-5 space-y-2"
          style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)' }}
        >
          <div className="text-xs font-mono-tab" style={{ color: 'var(--ink-muted)' }}>
            {scene.zoneNotes[signal.gaze]}
          </div>
          <p className="font-serif-ed text-base sm:text-lg leading-relaxed m-0">{beat.main}</p>
          <p
            className="font-serif-ed italic text-sm m-0 transition-opacity duration-300"
            style={{
              color: 'var(--pop)',
              opacity: hiddenUnlocked ? 1 : 0.48,
            }}
          >
            {hiddenUnlocked
              ? beat.hidden
              : `Hold steady breathing (≥ ${HIDDEN_UNLOCK_THRESHOLD}%) to clear haze and develop the hidden marginalia.`}
          </p>
        </div>
      </div>

      {/* Bottom Interactive Controls (always offers crisp accessible fallback controls) */}
      <div
        className="rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={signals.manualBlink}
            className="px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-transform active:scale-95"
            style={{ background: 'var(--pop)', color: 'var(--pop-contrast)' }}
          >
            Blink Cut · Space
          </button>

          <div
            className="inline-flex items-center p-1 rounded-full gap-1"
            style={{ background: 'var(--surface-alt)', border: '1px solid var(--line)' }}
          >
            <span className="font-mono-tab text-xs px-2" style={{ color: 'var(--ink-muted)' }}>
              GAZE
            </span>
            {(['left', 'center', 'right'] as GazeZone[]).map((z) => {
              const active = signal.gaze === z;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => signals.manualGaze(z)}
                  className="px-3 py-1 rounded-full text-xs cursor-pointer capitalize"
                  style={{
                    background: active ? 'var(--surface)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-muted)',
                    border: active ? '1px solid var(--line)' : '1px solid transparent',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {z}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="px-3 py-1.5 rounded-full text-xs cursor-pointer"
            style={{
              background: 'var(--surface-alt)',
              color: 'var(--ink-muted)',
              border: '1px solid var(--line)',
            }}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>

        <div className="flex flex-1 max-w-sm items-center gap-3">
          <span className="font-mono-tab text-xs shrink-0" style={{ color: 'var(--ink-muted)' }}>
            BREATH
          </span>
          <input
            type="range"
            min="10"
            max="100"
            value={signal.breathSteadiness}
            onChange={(e) => signals.manualBreath(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: 'var(--pop2)' }}
            aria-label="Breath Steadiness"
          />
          <span
            className="font-mono-tab text-xs font-semibold w-9 text-right"
            style={{ color: 'var(--pop2)' }}
          >
            {signal.breathSteadiness}%
          </span>
        </div>

        <button
          type="button"
          onClick={handleFinishEarly}
          className="px-4 py-2 rounded-full text-xs font-medium cursor-pointer"
          style={{
            background: 'var(--surface-alt)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
          }}
        >
          Finish Roll → Contact Sheet
        </button>
      </div>
    </main>
  );
}
