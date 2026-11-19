import { useNavigate } from 'react-router-dom';
import { ApertureHeroSvg, SignalArchitectureSvg } from '../components/HeroDiagram';
import { useSession } from '../context/SessionContext';

export function OverviewPage() {
  const navigate = useNavigate();
  const { signals } = useSession();

  return (
    <main className="flex-1">
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-14 lg:pt-16 lg:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'var(--pop-soft)', color: 'var(--pop)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--pop2)' }} />
            <span>Interactive Memory Essay · Webcam + Breath</span>
          </div>

          <h1 className="font-serif-ed text-4xl sm:text-5xl font-normal tracking-tight leading-[1.12] m-0">
            Memories slip every time you blink. Breathe steady to hold them still.
          </h1>

          <p className="text-base sm:text-lg leading-relaxed max-w-xl m-0" style={{ color: 'var(--ink-muted)' }}>
            Five quiet vignettes steered without touching a keyboard. Where your eyes rest sharpens
            the frame; steady chest breathing develops what was hidden inside it; every natural
            blink turns the page.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/calibrate')}
              className="px-6 py-3 rounded-full text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
              style={{ background: 'var(--pop)', color: 'var(--pop-contrast)' }}
            >
              Calibrate Camera &amp; Start →
            </button>
            <button
              type="button"
              onClick={() => {
                signals.setSource('sample');
                navigate('/experience');
              }}
              className="px-6 py-3 rounded-full text-sm font-medium cursor-pointer transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
              }}
            >
              Play Recorded Sample
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center">
          <ApertureHeroSvg />
        </div>
      </section>

      <section
        className="py-12"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div
                className="font-mono-tab text-xs uppercase tracking-widest"
                style={{ color: 'var(--pop)' }}
              >
                Signal Architecture
              </div>
              <h2 className="font-serif-ed text-2xl font-normal m-0 mt-1">
                Four human signals, zero wearables
              </h2>
            </div>
            <p className="text-xs m-0" style={{ color: 'var(--ink-muted)' }}>
              Powered by Presage SmartSpectra face + breathing metrics
            </p>
          </div>

          <SignalArchitectureSvg />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="space-y-1.5">
              <div className="text-sm font-semibold">Vercel Interactive Preview</div>
              <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--ink-muted)' }}>
                Judges without a local webcam can step through all five plates using keyboard
                signals or replay the bundled SmartSpectra session trace.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-semibold">Native Windows Bridge</div>
              <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--ink-muted)' }}>
                Local Node host captures 960×540 natively and streams only 478-point geometry and
                chest displacement—never pixel video over WebSocket.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-semibold">Strict Privacy Default</div>
              <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--ink-muted)' }}>
                Microphone stays off. Cardio stays disabled by default so Presage §7.4 LLM Insights
                cloud telemetry is never triggered.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
