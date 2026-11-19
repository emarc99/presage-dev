# AFTERIMAGE

> *Memories slip every time you blink. Breathe steady to hold them still.*

**AFTERIMAGE** is a five-scene interactive visual essay driven by your eyes and breath via the **Presage SmartSpectra Node.js SDK (`@smartspectra/node-sdk@3.5.0`)**. Steered without touching a keyboard, where you look shifts focus across each triptych scene, rolling chest-breath steadiness clears optical haze to reveal hidden marginalia, and every natural blink turns the page—ending in an exportable **Contact Sheet (`.png`)** of your sitting.

Built as a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).

---

## How It Responds to Human Signals

| Signal | SmartSpectra Source | How AFTERIMAGE Uses It |
| :--- | :--- | :--- |
| **Natural Blink** | `face.blinking` + scale-invariant Eye Aspect Ratio (`face.landmarks`) | Debounced (`320 ms`) shutter cut advancing Beat 1 → Beat 2 → Beat 3 → next Scene; long held closure (`≥ 1.1 s`) pauses/resumes drift. |
| **Coarse Eye Gaze** | Iris landmarks (`468`, `473`) + jaw/cheek yaw (`face.landmarks`) | Shifts active triptych focus (`Left` / `Center` / `Right`), subtle parallax depth, and zone captions with hysteresis deadband. |
| **Chest Breath Steadiness** | Rolling `4.5 s` window of `breathing.upperTrace` + `breathing.rate` | Evaluates waveform regularity (immune to `~1 s` chest-trace arrival lag and without stalling on `rate` warm-up), clearing SVG optical blur and slowing drift to reveal hidden marginalia. |
| **Subtle Tonal Echo** | `face.expression` probabilities | Gently shifts atmospheric shading and harmonic WebAudio detune (`Neutral`, `Warm`, `Heavy`)—recorded quietly on the final Contact Sheet. |

---

## Themes

Use the top-right switcher in the navigation bar at any time across all four pages (`/`, `/calibrate`, `/experience`, `/contact-sheet`):

1. **Monograph** (`Gallery Monograph`) — Daylight ivory paper, charcoal ink, cobalt + vermilion contrast.
2. **Solar Coral** (`Obsidian & Solar Coral`) — Deep obsidian darkroom ground, crisp white type, solar coral + electric mint.
3. **Botanical** (`Botanical Slate & Citrus`) — Warm alabaster surface, evergreen ink, emerald + citrus accents.

---

## Consent & Data Handling

- **Camera stays off until explicit consent:** Video capture never opens until you check consent and start capture on `/calibrate`.
- **No raw frames stored or sent to the browser:** The native Node host captures at `960×540 @ 30fps` locally (`127.0.0.1:4199`) and forwards only normalized geometric contour points and scalar breath/gaze/blink values over WebSocket. Microphone audio is never requested or opened.
- **No `cardioMetrics` by default:** Requesting only `faceMetrics + breathingMetrics` ensures consistent tracking across Fitzpatrick skin types I–VI and avoids triggering Presage's automatic Anthropic LLM Insights pipeline (§7.4 of the Nov 3, 2026 SmartSpectra SDK Privacy Policy).
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

Useful diagnostics:

```bash
npm run cameras                        # Enumerate native cameras (no key required)
npm run spike -- --skip-readiness      # Print live 1 Hz SmartSpectra metrics in terminal
npm test                               # Run deterministic SignalProcessor unit tests
```

### 2. Vercel Hosting (Interactive Preview + Sample Replay)

Because `@smartspectra/node-sdk` is a native desktop C++/FFI addon, it cannot run inside browsers or Vercel serverless functions. [vercel.json](./vercel.json) builds and deploys the lightweight React + Vite app (`web/`) directly to Vercel so reviewers can explore the full multi-page experience via **Recorded Sample Trace** replay or **Keyboard Interactive Mode** (`Space` = Blink, `←/↑/→` = Gaze, `Shift` / slider = Breath):

```bash
vercel --prod
```

---

## Architecture

- [`bridge/signal-processor.mjs`](./bridge/signal-processor.mjs) — Scale-invariant EAR blink debouncer, coarse L/C/R iris gaze estimator, rolling `4.5 s` chest-breath steadiness scorer, tonal echo smoother, and normalized silhouette extractor.
- [`bridge/server.mjs`](./bridge/server.mjs) — Localhost-only HTTP + WebSocket bridge streaming processed metrics from `@smartspectra/node-sdk` (`faceMetrics + breathingMetrics`, `enableTelemetry: false`) and serving `web/dist`.
- [`web/`](./web) — React 19 + Vite + TypeScript + Tailwind v4 SPA featuring bespoke multi-layer inline `<svg>` scenes, procedural WebAudio soundscape, and offscreen-canvas PNG Contact Sheet export.

---

## Non-Medical Notice

AFTERIMAGE is an interactive digital art and narrative experiment offered for informational and creative purposes only. It is not cleared by the FDA and does not diagnose, treat, cure, or prevent any disease or medical condition.

## License

MIT — see [LICENSE](./LICENSE).
