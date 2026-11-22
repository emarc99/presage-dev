import { useNavigate } from 'react-router-dom';
import { ReticleSvg } from '../components/ReticleSvg';
import { useSession } from '../context/SessionContext';
import type { SignalSource } from '../types/signals';

const SOURCES: { id: SignalSource; label: string; hint: string }[] = [
  { id: 'bridge', label: 'Live Bridge (ws://4199)', hint: 'Uses your local webcam via SmartSpectra SDK.' },
  { id: 'sample', label: 'Recorded Sample Trace', hint: 'Replays a real 366-frame Windows SmartSpectra sitting.' },
  { id: 'keyboard', label: 'Keyboard Interactive', hint: 'Control blinks (Space), gaze (arrows), breath slider.' },
];

export function CalibratePage() {
  const navigate = useNavigate();
  const {
    signals,
    consented,
    setConsented,
    enableCardio,
    setEnableCardio,
    selectedCameraId,
    setSelectedCameraId,
    resetSittingMetrics,
  } = useSession();

  const handleToggleCardio = () => {
    const next = !enableCardio;
    setEnableCardio(next);
    if (
      signals.source === 'bridge' &&
      (signals.bridgeStatus.state === 'running' || signals.bridgeStatus.state === 'starting')
    ) {
      signals.startLiveBridge(selectedCameraId || undefined, next);
    }
  };

  const handleStartSitting = () => {
    if (signals.source === 'bridge' && !consented) return;
    resetSittingMetrics();
    if (signals.source === 'bridge') {
      signals.startLiveBridge(selectedCameraId || undefined, enableCardio);
    }
    navigate('/experience');
  };

  const canEnter = signals.source !== 'bridge' || consented;

  return (
    <main className="flex-1">
      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div>
            <div
              className="font-mono-tab text-xs uppercase tracking-widest"
              style={{ color: 'var(--pop)' }}
            >
              Step 01 · Consent &amp; Framing
            </div>
            <h1 className="font-serif-ed text-3xl sm:text-4xl font-normal mt-2 mb-2">
              Sit comfortably before opening the shutter.
            </h1>
            <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--ink-muted)' }}>
              The camera remains off until you choose Live Bridge mode and check consent below. No
              raw frames or audio are recorded or stored.
            </p>
          </div>

          {/* Source Mode Selector */}
          <div
            className="p-1.5 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-1.5"
            style={{ background: 'var(--surface-alt)', border: '1px solid var(--line)' }}
          >
            {SOURCES.map((s) => {
              const active = signals.source === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => signals.setSource(s.id)}
                  className="py-2.5 px-3 rounded-lg text-xs cursor-pointer transition-all text-left sm:text-center"
                  style={{
                    background: active ? 'var(--surface)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-muted)',
                    border: active ? '1px solid var(--line)' : '1px solid transparent',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Bridge Setup Card when Live Bridge selected */}
          {signals.source === 'bridge' && (
            <div
              className="rounded-xl p-4 space-y-3 text-xs"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  Local Bridge Status:{' '}
                  <span style={{ color: signals.bridgeStatus.connected ? 'var(--pop2)' : 'var(--pop)' }}>
                    {signals.bridgeStatus.connected ? 'Connected' : 'Offline'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void signals.probeBridge()}
                  className="px-2.5 py-1 rounded cursor-pointer font-mono-tab"
                  style={{
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                  }}
                >
                  Re-check
                </button>
              </div>

              {!signals.bridgeStatus.connected ? (
                <p className="m-0 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                  Run <code className="font-mono-tab">npm start</code> in your local{' '}
                  <code className="font-mono-tab">presage</code> folder, or switch to{' '}
                  <strong>Recorded Sample Trace</strong> / <strong>Keyboard Interactive</strong> for
                  instant browser preview.
                </p>
              ) : (
                <div className="space-y-2">
                  <div style={{ color: 'var(--ink-muted)' }}>
                    API Key configured: <strong>{String(signals.bridgeStatus.apiKeyConfigured)}</strong> ·
                    Cameras: <strong>{signals.bridgeStatus.cameras.length}</strong>
                  </div>
                  {signals.bridgeStatus.cameras.length > 0 && (
                    <select
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-xs"
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink)',
                      }}
                    >
                      <option value="">Default Camera ({signals.bridgeStatus.cameras[0]?.name})</option>
                      {signals.bridgeStatus.cameras.map((cam) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => signals.startLiveBridge(selectedCameraId || undefined, enableCardio)}
                      disabled={!consented || signals.bridgeStatus.state === 'running'}
                      className="px-3 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-45"
                      style={{ background: 'var(--pop)', color: 'var(--pop-contrast)' }}
                    >
                      Test Live Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => signals.stopLiveBridge()}
                      className="px-3 py-1.5 rounded-lg cursor-pointer"
                      style={{
                        background: 'var(--surface-alt)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink)',
                      }}
                    >
                      Stop Camera
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        signals.bridgeStatus.recording
                          ? signals.stopRecording(true)
                          : signals.startRecording()
                      }
                      className="px-3 py-1.5 rounded-lg cursor-pointer font-mono-tab"
                      style={{
                        background: signals.bridgeStatus.recording ? 'var(--pop2-soft)' : 'var(--surface-alt)',
                        border: '1px solid var(--line)',
                        color: signals.bridgeStatus.recording ? 'var(--pop2)' : 'var(--ink)',
                      }}
                    >
                      {signals.bridgeStatus.recording
                        ? `Stop & Save Sample (${signals.bridgeStatus.recordedCount})`
                        : 'Record Sitting'}
                    </button>
                  </div>
                </div>
              )}
              {signals.bridgeStatus.error && (
                <div className="font-mono-tab" style={{ color: 'var(--pop2)' }}>
                  {signals.bridgeStatus.error}
                </div>
              )}
            </div>
          )}

          {/* Optional Opt-In Optical Pulse Toggle with Explicit Presage §7.4 Disclosure */}
          <div
            className="rounded-xl p-4 space-y-2.5 text-xs"
            style={{
              background: enableCardio ? 'var(--pop-soft)' : 'var(--surface)',
              border: `1px solid ${enableCardio ? 'var(--pop)' : 'var(--line)'}`,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                  Optional Optical Pulse (<code className="font-mono-tab">cardioMetrics</code>)
                </div>
                <div className="font-mono-tab text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Default: OFF · Opt-in · Presage §7.4 &amp; rPPG notice
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enableCardio}
                aria-label="Enable optional optical pulse measurement with §7.4 cloud processing"
                onClick={handleToggleCardio}
                className="relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer"
                style={{
                  background: enableCardio ? 'var(--pop)' : 'var(--surface-alt)',
                  border: '1px solid var(--line)',
                }}
              >
                <span
                  className="block w-4 h-4 rounded-full transition-transform"
                  style={{
                    background: enableCardio ? 'var(--pop-contrast)' : 'var(--ink-muted)',
                    transform: enableCardio ? 'translateX(22px)' : 'translateX(3px)',
                  }}
                />
              </button>
            </div>
            <p className="m-0 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              <strong>§7.4 Notice:</strong> OFF runs{' '}
              <code className="font-mono-tab">faceMetrics + breathingMetrics</code> only (no pulse/HRV).
              Per Presage §7.4, the SDK still auto-sends derived numeric summaries—never video—to
              Presage/Anthropic (<code className="font-mono-tab">requestInsight()</code> is never
              called). Optical rPPG degrades in dim light and darker skin (Fitzpatrick V–VI);{' '}
              <code className="font-mono-tab">&lt; 40%</code> confidence stays{' '}
              <code className="font-mono-tab">null</code> and never drives pacing.
            </p>
          </div>

          <ul className="space-y-3 p-0 m-0 list-none text-sm">
            <li className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 mt-0.5">
                <circle cx="10" cy="10" r="9" fill="var(--pop-soft)" />
                <path
                  d="M6.2,10.2 L8.8,12.8 L14,7.4"
                  fill="none"
                  stroke="var(--pop)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                <strong>No raw video saved:</strong> frames decode locally and drop immediately.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 mt-0.5">
                <circle cx="10" cy="10" r="9" fill="var(--pop-soft)" />
                <path
                  d="M6.2,10.2 L8.8,12.8 L14,7.4"
                  fill="none"
                  stroke="var(--pop)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                <strong>Inclusive breath optics:</strong> chest motion avoids rPPG skin-tone bias.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 mt-0.5">
                <circle cx="10" cy="10" r="9" fill="var(--pop-soft)" />
                <path
                  d="M6.2,10.2 L8.8,12.8 L14,7.4"
                  fill="none"
                  stroke="var(--pop)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                <strong>Minimal SDK defaults:</strong>{' '}
                <code className="font-mono-tab">enableTelemetry: false</code>, no{' '}
                <code className="font-mono-tab">requestInsight()</code>, cardio OFF.
              </span>
            </li>
          </ul>

          <div
            className="pt-4 flex flex-wrap items-center justify-between gap-4"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--pop)' }}
              />
              <span>I consent to local facial &amp; chest signal reading</span>
            </label>
            <button
              type="button"
              onClick={handleStartSitting}
              disabled={!canEnter}
              className="px-6 py-3 rounded-full text-sm font-semibold cursor-pointer disabled:opacity-45"
              style={{ background: 'var(--pop)', color: 'var(--pop-contrast)' }}
            >
              Enter Scene I →
            </button>
          </div>
        </div>

        {/* Precision Rangefinder Reticle */}
        <div
          className="lg:col-span-6 rounded-2xl p-6 space-y-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <div className="flex items-center justify-between">
            <span
              className="font-mono-tab text-xs uppercase tracking-wider"
              style={{ color: 'var(--ink-muted)' }}
            >
              Optical Rangefinder Reticle
            </span>
            <span
              className="font-mono-tab text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: 'var(--pop2-soft)', color: 'var(--pop2)' }}
            >
              {signals.source === 'bridge'
                ? `${signals.signal.fps} Hz · ${signals.bridgeStatus.state.toUpperCase()}`
                : signals.source === 'sample'
                ? 'SAMPLE STREAM'
                : 'PREVIEW READY'}
            </span>
          </div>

          <ReticleSvg
            silhouette={signals.signal.silhouette}
            gaze={signals.signal.gaze}
            faceDetected={signals.signal.faceDetected}
            breathSteadiness={signals.signal.breathSteadiness}
          />

          {signals.source === 'bridge' && signals.bridgeStatus.validationHint && (
            <div
              className="rounded-lg px-3 py-2 text-xs font-mono-tab flex items-center justify-between gap-2"
              style={{
                background:
                  signals.bridgeStatus.validation === 'kOk' ? 'var(--pop2-soft)' : 'var(--pop-soft)',
                color: signals.bridgeStatus.validation === 'kOk' ? 'var(--pop2)' : 'var(--pop)',
                border: '1px solid var(--line)',
              }}
            >
              <span>{signals.bridgeStatus.validationHint}</span>
              <span className="shrink-0 opacity-80">{signals.bridgeStatus.validation}</span>
            </div>
          )}

          <div
            className={`grid ${enableCardio ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-3 text-center text-xs`}
          >
            <div
              className="py-2.5 px-2 rounded-lg"
              style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
            >
              <div style={{ color: 'var(--ink-muted)' }}>Validation</div>
              <div className="font-semibold mt-0.5 truncate" style={{ color: 'var(--pop)' }}>
                {signals.source === 'bridge' ? signals.bridgeStatus.validation : 'Centered'}
              </div>
            </div>
            <div
              className="py-2.5 px-2 rounded-lg"
              style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
            >
              <div style={{ color: 'var(--ink-muted)' }}>Gaze</div>
              <div className="font-semibold mt-0.5 uppercase" style={{ color: 'var(--pop)' }}>
                {signals.signal.gaze}
              </div>
            </div>
            <div
              className="py-2.5 px-2 rounded-lg"
              style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
            >
              <div style={{ color: 'var(--ink-muted)' }}>Chest Wave</div>
              <div className="font-semibold mt-0.5" style={{ color: 'var(--pop2)' }}>
                {signals.signal.breathSteadiness}%
                {signals.signal.breathRate !== null ? ` · ${signals.signal.breathRate} bpm` : ''}
              </div>
            </div>
            {enableCardio && (
              <div
                className="py-2.5 px-2 rounded-lg"
                style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
              >
                <div style={{ color: 'var(--ink-muted)' }}>Pulse (§7.4)</div>
                <div className="font-semibold mt-0.5 truncate" style={{ color: 'var(--pop)' }}>
                  {signals.signal.pulseRate !== null
                    ? `${signals.signal.pulseRate} bpm (${signals.signal.pulseConfidence}%)`
                    : 'warming up'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
