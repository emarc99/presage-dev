import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundscape } from '../audio/soundscape';
import { SceneArt } from '../components/SceneArt';
import { SCENES } from '../data/scenes';
import { useSession } from '../context/SessionContext';
import type { GazeZone, TonalEcho } from '../types/signals';

const HIDDEN_UNLOCK_THRESHOLD = 60;
const SHUTTER_ARM_MS = 4200;

export function ExperiencePage() {
  const navigate = useNavigate();
  const {
    signals,
    enableCardio,
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
  const [armedElapsedMs, setArmedElapsedMs] = useState(0);
  const [apertureRippleKey, setApertureRippleKey] = useState(0);

  const scene = SCENES[sceneIdx];
  const beat = scene.beats[beatIdx];
  const { signal, paused, setPaused, stopLiveBridge, manualBlink, manualGaze, manualBreath } =
    signals;

  const latestSignalRef = useRef(signal);
  latestSignalRef.current = signal;
  const armedElapsedRef = useRef(0);
  armedElapsedRef.current = armedElapsedMs;
  const manualBypassRef = useRef(false);

  const statsRef = useRef({
    sceneIdx: 0,
    startedAtMs: Date.now(),
    blinkCuts: 0,
    steadinessSum: 0,
    steadinessSamples: 0,
    pulseSum: 0,
    pulseSamples: 0,
    latestWave: [] as number[],
    gazeCounts: { left: 0, center: 0, right: 0 },
    echoCounts: { neutral: 0, warm: 0, heavy: 0 } as Record<TonalEcho, number>,
    unlockedBeats: new Set<number>(),
    flushed: false,
  });

  const flushSceneStats = useCallback(
    (targetIdx: number) => {
      const st = statsRef.current;
      const sig = latestSignalRef.current;
      const holdSeconds = Number(Math.max(0.5, (Date.now() - st.startedAtMs) / 1000).toFixed(1));
      const avgSteadiness =
        st.steadinessSamples > 0
          ? Math.round(st.steadinessSum / st.steadinessSamples)
          : sig.breathSteadiness;
      const avgPulseBpm =
        st.pulseSamples > 0 ? Number((st.pulseSum / st.pulseSamples).toFixed(1)) : null;

      let dominantEcho: TonalEcho = 'neutral';
      if (st.echoCounts.warm > st.echoCounts.neutral && st.echoCounts.warm >= st.echoCounts.heavy) {
        dominantEcho = 'warm';
      } else if (
        st.echoCounts.heavy > st.echoCounts.neutral &&
        st.echoCounts.heavy > st.echoCounts.warm
      ) {
        dominantEcho = 'heavy';
      }

      st.flushed = true;
      commitSceneStats(targetIdx, {
        holdSeconds,
        blinkCuts: st.blinkCuts,
        avgSteadiness,
        breathRibbon: st.latestWave.length > 0 ? st.latestWave : sig.breathWave,
        gazeCounts: { ...st.gazeCounts },
        dominantEcho,
        unlockedHiddenCount: st.unlockedBeats.size,
        avgPulseBpm,
      });
    },
    [commitSceneStats]
  );

  const resetSceneAccumulator = useCallback((nextIdx: number) => {
    statsRef.current = {
      sceneIdx: nextIdx,
      startedAtMs: Date.now(),
      blinkCuts: 0,
      steadinessSum: 0,
      steadinessSamples: 0,
      pulseSum: 0,
      pulseSamples: 0,
      latestWave: [],
      gazeCounts: { left: 0, center: 0, right: 0 },
      echoCounts: { neutral: 0, warm: 0, heavy: 0 },
      unlockedBeats: new Set<number>(),
      flushed: false,
    };
  }, []);

  const advanceOnBlink = useCallback(() => {
    const isManual = manualBypassRef.current;
    manualBypassRef.current = false;

    if (paused && !isManual) {
      return;
    }

    if (!isManual && armedElapsedRef.current < SHUTTER_ARM_MS) {
      soundscape.ensureStarted(SCENES[sceneIdx].baseHz);
      setApertureRippleKey((k) => k + 1);
      return;
    }

    soundscape.ensureStarted(SCENES[sceneIdx].baseHz);
    soundscape.playShutterClick();
    setShutterCount((c) => c + 1);
    statsRef.current.blinkCuts += 1;
    setArmedElapsedMs(0);
    armedElapsedRef.current = 0;

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
      stopLiveBridge();
      navigate('/contact-sheet');
    }
  }, [beatIdx, flushSceneStats, markCompleted, navigate, paused, resetSceneAccumulator, sceneIdx, stopLiveBridge]);

  // Bind live blink handler from SmartSpectra / Sample Trace / Manual trigger
  useEffect(() => {
    registerBlinkHandler(advanceOnBlink);
    return () => registerBlinkHandler(null);
  }, [advanceOnBlink, registerBlinkHandler]);

  // Dwell-arming 4.2s clock per beat (pauses automatically during long-blink pause)
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setArmedElapsedMs((prev) => Math.min(SHUTTER_ARM_MS + 100, prev + 120));
    }, 120);
    return () => window.clearInterval(id);
  }, [paused, sceneIdx, beatIdx]);

  // Flush partial scene stats cleanly ONLY once when sceneIdx changes or user leaves page via navbar
  useEffect(() => {
    const currentIdx = sceneIdx;
    return () => {
      if (statsRef.current.sceneIdx === currentIdx && !statsRef.current.flushed) {
        flushSceneStats(currentIdx);
      }
    };
  }, [flushSceneStats, sceneIdx]);

  // Accumulate breath/gaze/echo/pulse samples on every signal tick
  useEffect(() => {
    const st = statsRef.current;
    st.steadinessSum += signal.breathSteadiness;
    st.steadinessSamples += 1;
    if (enableCardio && signal.pulseRate !== null) {
      st.pulseSum += signal.pulseRate;
      st.pulseSamples += 1;
    }
    if (signal.breathWave.length > 0) {
      st.latestWave = signal.breathWave;
    }
    st.gazeCounts[signal.gaze] += 1;
    st.echoCounts[signal.echo] += 1;
    if (signal.breathSteadiness >= HIDDEN_UNLOCK_THRESHOLD && !st.unlockedBeats.has(beatIdx)) {
      st.unlockedBeats.add(beatIdx);
      soundscape.playMarginaliaChime();
    }
  }, [beatIdx, enableCardio, signal]);

  // Update procedural soundscape
  useEffect(() => {
    soundscape.setSceneTone(scene.baseHz);
  }, [scene.baseHz]);

  useEffect(() => {
    soundscape.update(signal.breathSteadiness, signal.echo, signal.gaze, signal.breathPhase);
  }, [signal.breathSteadiness, signal.echo, signal.gaze, signal.breathPhase]);

  // Smooth drift loop slowed by calm breathing (~15 fps to avoid 60Hz SVG feGaussianBlur thrash)
  useEffect(() => {
    let rafId = 0;
    let lastTick = performance.now();
    const step = (now: number) => {
      if (!paused && now - lastTick >= 66) {
        const dtFactor = Math.min(2.5, (now - lastTick) / 16.67);
        lastTick = now;
        const speed = 1.15 - (latestSignalRef.current.breathSteadiness / 100) * 0.85;
        setParallaxOffset((prev) => (prev + 0.32 * dtFactor * speed) % 240);
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [paused]);

  const triggerManualBlink = useCallback(() => {
    manualBypassRef.current = true;
    manualBlink();
  }, [manualBlink]);

  // Keyboard shortcuts (Space = Instant Blink Cut bypass, Arrows = Gaze, Shift hold = Steady breath)
  useEffect(() => {
    let shiftInterval: number | null = null;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        ev.preventDefault();
        triggerManualBlink();
      } else if (ev.key === 'ArrowLeft') {
        manualGaze('left');
      } else if (ev.key === 'ArrowUp') {
        manualGaze('center');
      } else if (ev.key === 'ArrowRight') {
        manualGaze('right');
      } else if (ev.key === 'Shift' && shiftInterval === null) {
        shiftInterval = window.setInterval(() => {
          manualBreath(Math.min(96, latestSignalRef.current.breathSteadiness + 5));
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
  }, [manualBreath, manualGaze, triggerManualBlink]);

  const driftMultiplier = (1.15 - (signal.breathSteadiness / 100) * 0.85).toFixed(2);
  const hiddenUnlocked = signal.breathSteadiness >= HIDDEN_UNLOCK_THRESHOLD;
  const shutterArmed = armedElapsedMs >= SHUTTER_ARM_MS;
  const wavePolyline = (
    signal.breathWave.length > 1 ? signal.breathWave : [0, 0.25, 0.5, 0.25, 0, -0.25, -0.5, -0.25, 0]
  )
    .map((v, i, arr) => {
      const x = (i / Math.max(1, arr.length - 1)) * 78;
      const y = 12 - Math.max(-1, Math.min(1, v)) * 9;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

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
          {enableCardio && (
            <span>
              PULSE (§7.4):{' '}
              <strong style={{ color: 'var(--pop)' }}>
                {signal.pulseRate !== null
                  ? `${signal.pulseRate} BPM (${signal.pulseConfidence}%)`
                  : 'warming-up'}
              </strong>
            </span>
          )}
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

      {/* Compact 1-Line Gesture Guide & Live Camera Cue */}
      <div
        className="rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--ink-muted)' }}>
          <span>
            <strong style={{ color: 'var(--ink)' }}>Look L/C/R</strong> to shift focus
          </span>
          <span>·</span>
          <span>
            <strong style={{ color: 'var(--ink)' }}>Breathe steadily (≥ 60%)</strong> to sharpen &amp; unlock note
          </span>
          <span>·</span>
          <span>
            <strong style={{ color: 'var(--ink)' }}>Blink after 4.2 s</strong> to cut
          </span>
          <span>·</span>
          <span>
            <strong style={{ color: 'var(--ink)' }}>Hold 1.1 s</strong> to pause
          </span>
        </div>
        {signals.source === 'bridge' &&
          signals.bridgeStatus.validation !== 'kOk' &&
          signals.bridgeStatus.validationHint && (
            <span
              className="font-mono-tab px-2 py-0.5 rounded-full shrink-0"
              style={{ background: 'var(--pop-soft)', color: 'var(--pop)' }}
            >
              {signals.bridgeStatus.validationHint}
            </span>
          )}
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
          breathPhase={signal.breathPhase}
          echo={signal.echo}
          parallaxOffset={parallaxOffset}
          apertureRippleKey={apertureRippleKey}
        />

        {/* Focus Gaze Tag + Dwell Shutter State inside Top Corner */}
        <div className="pointer-events-none absolute top-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tab">
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
          <div className="flex flex-wrap items-center gap-2">
            {signal.talking && (
              <span
                className="px-2.5 py-1 rounded-full font-semibold"
                style={{
                  background: 'var(--pop2-soft)',
                  color: 'var(--pop2)',
                  border: '1px solid var(--line)',
                }}
              >
                TALKING · BREATH HELD
              </span>
            )}
            {enableCardio && signal.pulseRate !== null && (
              <span
                className="px-2.5 py-1 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
                  color: 'var(--pop)',
                  border: '1px solid var(--line)',
                }}
              >
                PULSE {signal.pulseRate} BPM
              </span>
            )}
            {paused ? (
              <span
                className="px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'var(--pop2)', color: 'var(--pop-contrast)' }}
              >
                PAUSED (LONG BLINK)
              </span>
            ) : (
              <span
                className="px-2.5 py-1 rounded-full font-semibold"
                style={{
                  background: shutterArmed
                    ? 'var(--pop-soft)'
                    : 'color-mix(in srgb, var(--bg) 82%, transparent)',
                  color: shutterArmed ? 'var(--pop)' : 'var(--ink-muted)',
                  border: '1px solid var(--line)',
                }}
              >
                {shutterArmed
                  ? 'SHUTTER ARMED · BLINK TO CUT'
                  : `EXPOSING · ${(armedElapsedMs / 1000).toFixed(1)}s / 4.2s`}
              </span>
            )}
          </div>
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
            onClick={triggerManualBlink}
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

        <div className="flex flex-1 max-w-md items-center gap-3">
          <span className="font-mono-tab text-xs shrink-0" style={{ color: 'var(--ink-muted)' }}>
            BREATH
          </span>
          <svg
            width="80"
            height="24"
            viewBox="0 0 80 24"
            className="shrink-0 rounded px-0.5"
            style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
            aria-label="Live chest wave ribbon"
          >
            <polyline
              fill="none"
              stroke="var(--pop2)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={wavePolyline}
            />
          </svg>
          <input
            type="range"
            min="10"
            max="100"
            value={signal.breathSteadiness}
            onChange={(e) => manualBreath(Number(e.target.value))}
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
