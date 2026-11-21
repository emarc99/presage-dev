import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlateThumb } from '../components/PlateThumb';
import { useSession } from '../context/SessionContext';
import { exportContactSheetPng } from '../utils/exportSheet';

export function ContactSheetPage() {
  const navigate = useNavigate();
  const { report, theme, signals, eraseSession } = useSession();
  const [toast, setToast] = useState<string | null>(null);

  const records = report.records;
  const totalHold = records.reduce((acc, r) => acc + r.holdSeconds, 0);
  const totalBlinks = records.reduce((acc, r) => acc + r.blinkCuts, 0);
  const visitedCount = records.filter((r) => r.holdSeconds > 0).length;
  const avgBreath =
    visitedCount > 0
      ? Math.round(
          records
            .filter((r) => r.holdSeconds > 0)
            .reduce((acc, r) => acc + r.avgBreathSteadiness, 0) / visitedCount
        )
      : 0;
  const pulseRecords = records.filter((r) => r.holdSeconds > 0 && typeof r.avgPulseBpm === 'number');
  const overallPulse =
    pulseRecords.length > 0
      ? (
          pulseRecords.reduce((acc, r) => acc + (r.avgPulseBpm || 0), 0) / pulseRecords.length
        ).toFixed(1)
      : null;

  const handleDownload = async () => {
    await exportContactSheetPng(records, theme, report.source);
    setToast('Exported afterimage-contact-sheet.png cleanly (no raw video pixels stored).');
  };

  const handleErase = () => {
    eraseSession();
    setToast('Session metrics wiped from memory.');
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-8">
      <div
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div className="space-y-2">
          <div
            className="font-mono-tab text-xs uppercase tracking-widest"
            style={{ color: 'var(--pop)' }}
          >
            {report.completed ? 'Sitting Complete · 5 Plates Developed' : 'Developing Roll · In Progress'}
          </div>
          <h1 className="font-serif-ed text-3xl sm:text-4xl font-normal m-0">
            Your Afterimage Contact Sheet
          </h1>
          <p className="text-sm m-0" style={{ color: 'var(--ink-muted)' }}>
            Total sitting <strong style={{ color: 'var(--ink)' }}>{totalHold.toFixed(1)}s</strong> ·{' '}
            <strong style={{ color: 'var(--pop)' }}>{totalBlinks} blink cuts</strong> · Average
            breath steadiness <strong style={{ color: 'var(--pop2)' }}>{avgBreath}%</strong>
            {overallPulse && (
              <>
                {' '}
                · Opt-in pulse <strong style={{ color: 'var(--pop)' }}>{overallPulse} bpm</strong>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
            style={{ background: 'var(--pop)', color: 'var(--pop-contrast)' }}
          >
            Download Print (.png)
          </button>
          <button
            type="button"
            onClick={() => navigate('/calibrate')}
            className="px-4 py-2.5 rounded-full text-xs font-medium cursor-pointer"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
            }}
          >
            New Sitting
          </button>
          <button
            type="button"
            onClick={handleErase}
            className="px-4 py-2.5 rounded-full text-xs font-medium cursor-pointer"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              color: 'var(--ink-muted)',
            }}
          >
            Erase Session Data
          </button>
        </div>
      </div>

      {signals.bridgeStatus.recording && (
        <div
          className="px-4 py-3 rounded-xl text-xs font-mono-tab flex flex-wrap items-center justify-between gap-3"
          style={{
            background: 'var(--pop2-soft)',
            color: 'var(--pop2)',
            border: '1px solid var(--line)',
          }}
        >
          <span>
            RECORDING ACTIVE · {signals.bridgeStatus.recordedCount} signal frames captured
          </span>
          <button
            type="button"
            onClick={() => {
              signals.stopRecording(true);
              setToast('Saved live SmartSpectra trace to web/public/sample-trace.json + recordings/.');
            }}
            className="px-3.5 py-1.5 rounded-full font-semibold cursor-pointer"
            style={{ background: 'var(--pop2)', color: 'var(--pop-contrast)' }}
          >
            Save Recording → sample-trace.json
          </button>
        </div>
      )}

      {toast && (
        <div
          className="px-4 py-3 rounded-xl text-xs font-mono-tab flex items-center justify-between"
          style={{
            background: 'var(--pop-soft)',
            color: 'var(--pop)',
            border: '1px solid var(--line)',
          }}
        >
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="underline cursor-pointer bg-transparent border-0"
            style={{ color: 'var(--pop)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {records.map((rec) => {
          const unvisited = rec.holdSeconds === 0;
          const hasWave = !unvisited && rec.breathRibbon.length > 1;
          const wavePath = hasWave
            ? rec.breathRibbon
                .map((v, wi) => {
                  const x = (wi / Math.max(1, rec.breathRibbon.length - 1)) * 160;
                  const y = 14 - v * 10;
                  return `${wi === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ')
            : '';

          const gSum = rec.gazeCounts.left + rec.gazeCounts.center + rec.gazeCounts.right;
          const hasGaze = !unvisited && gSum > 0;
          const lPct = hasGaze ? (rec.gazeCounts.left / gSum) * 100 : 0;
          const cPct = hasGaze ? (rec.gazeCounts.center / gSum) * 100 : 0;
          const rPct = hasGaze ? (rec.gazeCounts.right / gSum) * 100 : 0;

          return (
            <article
              key={rec.sceneIndex}
              className="rounded-2xl overflow-hidden flex flex-col justify-between"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                opacity: unvisited ? 0.68 : 1,
              }}
            >
              <div className="h-32 overflow-hidden" style={{ borderBottom: '1px solid var(--line)' }}>
                <PlateThumb sceneIndex={rec.sceneIndex} />
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div
                    className="flex items-center justify-between font-mono-tab text-xs"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    <span>PLATE {rec.roman}</span>
                    <span>
                      {rec.holdSeconds.toFixed(1)}s · {rec.blinkCuts} blinks
                    </span>
                  </div>
                  <h2 className="font-serif-ed text-base font-normal mt-1 mb-1">{rec.title}</h2>
                  <p className="text-xs leading-snug m-0" style={{ color: 'var(--ink-muted)' }}>
                    {unvisited ? (
                      'Not yet visited in this sitting.'
                    ) : (
                      <>
                        {rec.unlockedHiddenCount}/3 hidden notes developed · Echo: {rec.dominantEcho}
                        {typeof rec.avgPulseBpm === 'number' && (
                          <span className="block mt-1 font-mono-tab" style={{ color: 'var(--pop)' }}>
                            Pulse (§7.4): {rec.avgPulseBpm.toFixed(1)} bpm
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <svg viewBox="0 0 160 28" className="w-full h-7">
                    {hasWave ? (
                      <path
                        d={wavePath}
                        fill="none"
                        stroke="var(--pop2)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    ) : (
                      <line
                        x1="0"
                        y1="14"
                        x2="160"
                        y2="14"
                        stroke="var(--line)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                    )}
                  </svg>
                  <div
                    className="h-1.5 rounded-full overflow-hidden flex"
                    style={{ background: 'var(--surface-alt)' }}
                    title={hasGaze ? 'Gaze distribution L / C / R' : 'No gaze samples recorded'}
                  >
                    {hasGaze && (
                      <>
                        <span style={{ width: `${lPct}%`, background: 'var(--ink-muted)' }} />
                        <span style={{ width: `${cPct}%`, background: 'var(--pop)' }} />
                        <span style={{ width: `${rPct}%`, background: 'var(--pop2)' }} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
