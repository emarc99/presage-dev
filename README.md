<p align="center">
  <img src="./web/public/afterimage-logo.png" alt="AFTERIMAGE Logo" width="180" />
</p>

# AFTERIMAGE

> *Memories slip every time you blink. Breathe steady to hold them still.*

**AFTERIMAGE** is a five-scene interactive visual essay driven by your eyes and breath via the **Presage SmartSpectra Node.js SDK (`@smartspectra/node-sdk@3.5.0`)**. Steered without touching a keyboard, where you look shifts focus across each triptych scene, rolling chest-breath steadiness clears optical haze to reveal hidden marginalia, and every natural blink turns the page—ending in an exportable **Contact Sheet (`.png`)** of your sitting.

Built as a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).

- **Interactive Preview (Vercel):** https://afterimage-presage.vercel.app *(plays a real 366-frame Windows SmartSpectra sitting at 1× pace or Keyboard mode)*
- **Source Code:** https://github.com/emarc99/presage-dev

<p align="center">
  <img src="./web/public/contact-sheet-sample.png" alt="AFTERIMAGE Developed Contact Sheet (205.5s Live Windows Sitting)" width="780" />
</p>

---

## How It Responds to Human Signals

| Signal | SmartSpectra Source | How AFTERIMAGE Uses It |
| :--- | :--- | :--- |
| **Natural Blink (Reopen)** | `face.blinking` + scale-invariant Eye Aspect Ratio (`face.landmarks`, `earBlinkThreshold = 0.21`) | Blink-on-reopen (`< 650 ms`, `360 ms` debounce) triggers a shutter cut once the beat's **`4.2 s` Shutter Armed** dwell completes (early blinks show an aperture ripple; `Space` cuts immediately). Deliberate long closure (`>= 1.1 s`) toggles pause/resume without prematurely cutting. |
| **Coarse Eye Gaze** | Additive iris (`468`, `473`) + jaw/cheek yaw deviation (`< 0.455 / > 0.545`, `0.478 / 0.522` return) | Shifts active triptych focus (`Left` / `Center` / `Right`) with smooth `420 ms` crossfade, stereo audio pan, parallax depth, and zone captions. |
| **Chest Breath Steadiness** | Rolling `4.5 s` OLS linear-detrended `breathing.upperTrace` + `breathing.rate` | Removes slow posture/auto-exposure baseline drift, computes smoothness + `breathPhase` (`[-1..1]`) to drive steam/dust/halo motion, filtered pink-noise ambience, optical de-haze, and hidden marginalia chime unlocks. Protected by a `>= 5`-frame onset & `900 ms` hold `face.talking` speech-artifact guard. |
| **Subtle Tonal Echo** | `face.expression` probabilities | Calibrated thresholds (`heavy >= 86%` with `0.90/0.10` EMA, `warm >= 45%` with `0.82/0.18` EMA) keep resting neutral expressions steady while shifting lighting warmth and WebAudio detune on sustained changes. |
| **Optical Pulse (Opt-in)** | `cardio.pulseRate` (`cardioMetrics`, **OFF by default**) | Optional opt-in toggle on `/calibrate` with explicit §7.4 and skin-tone disclosure. Values below `40%` confidence are suppressed (`null`). |

---

## Themes

Use the top-right switcher in the navigation bar at any time across all four pages (`/`, `/calibrate`, `/experience`, `/contact-sheet`):

1. **Monograph** (`Gallery Monograph`) — Daylight ivory paper, charcoal ink, cobalt + vermilion contrast.
2. **Solar Coral** (`Obsidian & Solar Coral`) — Deep obsidian darkroom ground, crisp white type, solar coral + electric mint.
3. **Botanical** (`Botanical Slate & Citrus`) — Warm alabaster surface, evergreen ink, emerald + citrus accents.

---

## Consent, Privacy & Presage §7.4 Disclosure

- **Camera stays off until explicit consent:** Video capture never opens until you check consent and start capture on `/calibrate` (or automatically reconnects safely across `/calibrate` -> `/experience` via serialized bridge stream reuse).
- **No raw frames stored or sent to the browser:** The native Node host captures at `960×540 @ 30fps` locally (`127.0.0.1:4199`) and forwards only normalized geometric contour points and scalar breath/gaze/blink values over WebSocket (`enableTelemetry: false`). Microphone audio is never requested or opened.
- **No `cardioMetrics` by default (Presage Privacy Policy §7.4):** Requesting only `faceMetrics + breathingMetrics` ensures reliable tracking without camera rPPG skin-tone bias and **avoids triggering Presage's automatic Presage → Anthropic LLM Insights pipeline (§7.4 of the Nov 3, 2026 SmartSpectra SDK Privacy Policy)**.
- **Optional opt-in `cardioMetrics` toggle (`/calibrate`):** You can explicitly switch ON optical pulse (`cardioMetrics`) during calibration after reviewing the inline disclosure: enabling `cardioMetrics` transmits physiological pulse telemetry subject to Presage §7.4 Anthropic LLM Insights processing, and camera rPPG reliability drops in dim light or across darker skin tones (Fitzpatrick V–VI), so readings below `40%` confidence are hidden (`null`) and pulse never drives scene pacing.
- **One-click erasure:** Erase in-memory session metrics anytime from `/contact-sheet`.

---

## Quickstart

### 1. Local Live Webcam (Windows / macOS / Linux)

Requires **Node.js >= 20** and a Presage SmartSpectra API key.

```bash
# Install native bridge + frontend dependencies
npm install
npm --prefix web install

# Add your Presage API key
cp .env.example .env
# Edit .env -> SMARTSPECTRA_API_KEY=...

# Build the React + Vite frontend
npm run build

# Start the local SmartSpectra WebSocket bridge + static server
npm start
# Open http://127.0.0.1:4199
```

Useful diagnostics & trace recording:

```bash
npm run cameras                                            # Enumerate native cameras (no key required)
npm run spike -- --skip-readiness --seconds 20             # Print live 1 Hz SmartSpectra metrics in terminal
node bridge/server.mjs --record recordings/sitting.jsonl   # Record sanitized signal frames to JSONL (plus WS record_start / record_stop with saveAsSample -> web/public/sample-trace.json)
npm test                                                   # Run deterministic SignalProcessor unit tests
```

### 2. Vercel Hosting (Interactive Preview + Real Recorded Sample Replay)

Live deployment: **https://afterimage-presage.vercel.app**

Because `@smartspectra/node-sdk` is a native desktop C++/FFI addon, it cannot run inside browsers or Vercel serverless functions. [vercel.json](./vercel.json) builds and deploys the lightweight React + Vite app (`web/`) directly to Vercel so reviewers can explore the full multi-page experience via **Recorded Sample Trace** (bundling a real 366-keyframe, `213.28 s` Windows webcam capture in [`web/public/sample-trace.json`](./web/public/sample-trace.json)) or **Keyboard Interactive Mode** (`Space` = Instant Blink Cut, `←/↑/→` = Gaze, `Shift` / slider = Breath):

```bash
vercel --prod
```

---

## Architecture

- [`bridge/signal-processor.mjs`](./bridge/signal-processor.mjs) — Scale-invariant EAR blink-on-reopen debouncer (`earBlinkThreshold = 0.21`), `1.1 s` long-blink pause detector, `>= 5`-frame onset & `900 ms` hold `face.talking` guard, additive iris + yaw deviation gaze estimator (`< 0.455 / > 0.545`), OLS linear-detrended `4.5 s` chest-breath steadiness + `breathPhase` scorer, calibrated tonal echo smoother, confidence-gated (`>= 40%`) opt-in `cardio.pulseRate`, and normalized silhouette extractor.
- [`bridge/server.mjs`](./bridge/server.mjs) — Serialized-mutex localhost HTTP + WebSocket bridge with cached camera enumeration and change-filtered validation status streaming processed metrics from `@smartspectra/node-sdk` (`faceMetrics + breathingMetrics` by default, opt-in `cardioMetrics`, `enableTelemetry: false`), optional JSONL recorder / `web/public/sample-trace.json` exporter, and static server for `web/dist`.
- [`web/`](./web) — React 19 + Vite + TypeScript + Tailwind v4 SPA featuring bespoke breath-reactive inline `<svg>` scenes, pink-noise + chime WebAudio soundscape, `4.2 s` Shutter Armed dwell UX, `366`-frame `recorded_sitting` 1× sample replay, and 5-plate Canvas PNG Contact Sheet export (`1600×920`).

---

## Non-Medical Notice

AFTERIMAGE is an interactive digital art and narrative experiment offered for informational and creative purposes only. It is not cleared by the FDA and does not diagnose, treat, cure, or prevent any disease or medical condition.

## License

MIT — see [LICENSE](./LICENSE).
