<p align="center">
  <img src="./web/public/afterimage-logo.png" alt="AFTERIMAGE Logo" width="180" />
</p>

# AFTERIMAGE

> *A blink is a cut, not a click. Breathe steady to hold the frame still.*

**AFTERIMAGE** is a five-scene interactive visual essay navigated without touching a keyboard, powered by the **Presage SmartSpectra Node.js SDK (`@smartspectra/node-sdk@3.5.0`)**. Inspired by film editor [**Walter Murch**'s](https://www.imdb.com/name/nm0004555/) [*In the Blink of an Eye*](https://en.wikipedia.org/wiki/In_the_Blink_of_an_Eye_%28book%29) (the observation that a human blink punctuates one thought from the next alongside the rhythm of breathing) and the blink-driven memory storytelling of [*Before Your Eyes*](https://www.imdb.com/title/tt15575678/), AFTERIMAGE turns involuntary webcam signals into slow darkroom controls: where you look shifts focus across a three-panel plate, chest breathing steadiness clears optical haze and develops hidden marginalia, and every natural blink turns the page once a **`4.2 s` Shutter Armed** dwell lock clears—ending in an exportable **Contact Sheet (`.png`)** of your sitting.

Built as a solo submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).

- **Interactive Preview (Vercel):** https://afterimage-presage.vercel.app *(boots automatically into **Recorded Sample Trace** mode replaying `366` keyframes from a real Windows SmartSpectra sitting at 1× pace, or **Keyboard Interactive** mode)*
- **Source Code:** https://github.com/emarc99/presage-dev
- **Windows Hardware & SDK Log:** [`docs/SDK-NOTES.md`](./docs/SDK-NOTES.md)

<p align="center">
  <img src="./web/public/contact-sheet-sample.png" alt="AFTERIMAGE Developed Contact Sheet exported from Sitting 2 (205.5s Live Windows Bridge)" width="780" />
</p>
<p align="center"><em>Sitting 2 Contact Sheet PNG exported from the live Windows webcam bridge: 205.5 s, 15 armed blink cuts (out of 26 raw blinks), 63% 5-plate breath clarity (63.9% mean across 366 trace keyframes), 91 Left / 235 Center / 40 Right gaze frames, and 11/15 hidden notes developed.</em></p>

---

## Visual Walkthrough

| `/calibrate` (`Recorded Sample Trace` capture) | `/experience` (`Recorded Sample Trace` capture) |
| :---: | :---: |
| <img src="./web/public/calibrate-darkroom.png" alt="Darkroom calibration screen in Recorded Sample Trace mode showing explicit camera consent, §7.4 pulse toggle, and normalized 478-landmark reticle" width="420" /> | <img src="./web/public/experience-triptych.png" alt="Plate I Morning Steam during Recorded Sample Trace playback showing FOCUS SHARP 76%, Center Ceramic Cup focus, SHUTTER ARMED, and developed italic marginalia" width="420" /> |
| *Explicit pre-capture consent, corrected §7.4 `cardioMetrics` opt-in notice, and normalized 478-landmark vector silhouette.* | *Replaying `sample-trace.json`: `Sample Trace` active, `FOCUS SHARP · 76%`, `SHUTTER ARMED · BLINK TO CUT`, and unlocked cobalt marginalia.* |

---

## How It Responds to Human Signals

| Signal | SmartSpectra Source | How AFTERIMAGE Processes It | Effect in the Room |
| :--- | :--- | :--- | :--- |
| **Quick Blink Cut** | `face.landmarks` (478 pixel pts) + `face.blinking` | Scale-invariant 6-pt EAR (`< 0.21`), triggered **on reopen** (`< 650 ms`, `360 ms` debounce) after `4.2 s` **Shutter Armed** dwell | Aperture click sound + hard cut across 15 beats (`I–V`); early reading blinks (`11` in Sitting 2) ripple instead of cutting |
| **Long Eye-Close Pause** | Prolonged low EAR (`< 0.21` held `>= 1.1 s`) | Buffered closure suppresses `face.blinking` pulses after `400 ms` so pauses never trigger an accidental cut | Toggles pause / resume without advancing beat |
| **Horizontal Gaze (`L / C / R`)** | Iris centers (`468`, `473`) + nose/cheek `yawRatio` | Additive deviation around center (`0.5 + irisDelta * 0.95 + yawDelta * 0.55`), `< 0.455 / > 0.545` with return hysteresis | Shifts sharp panel (`420 ms` crossfade), parallax depth, zone captions, and stereo WebAudio pan |
| **Chest Breath Steadiness** | `breathing.upperTrace` + `breathing.rate` + `face.talking` | `4.5 s` OLS linear detrend + 2nd-diff curvature steadiness + `>= 5`-frame talking onset (`900 ms` hold) guard | Clears SVG blur (`feGaussianBlur`), slows drift velocity, swells pink-noise bed; `>= 60%` rings chime & reveals hidden note |
| **Subtle Tonal Echo** | `face.expression` (`HAPPY`, `SAD`, `FEAR`, `ANGRY`, `NEUTRAL`) | `0.82/0.18` warm (`>= 45%`), `0.90/0.10` heavy (`>= 86%`) EMA to tolerate downward laptop camera angles | Subtle color temperature & ambient chord detune (`neutral` / `warm` / `heavy`) |
| **Optical Pulse (Opt-in)** | `cardio.pulseRate` (`cardioMetrics`, **OFF by default**) | Confidence-gated (`>= 40%`, else `null`); never steers scene timing or unlocks | Displayed read-only on `/calibrate` and `/contact-sheet` only when explicitly toggled ON |

---

## Sitting 1 vs. Sitting 2 Calibration Progression

| Run | Duration & Frames | Breath Clarity | Gaze Split (`L / C / R`) | Notes Unlocked | What Broke / What Fixed It |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pre-flight probe** | `0 s` (`kInputUnavailable`) | — | — | — | `CameraSelection.front` failed on Windows MediaFoundation; `checkDeviceReadiness()` stalled for 30 s. Switched directly to `CameraSelection.default` / `.byId()` (`~7 s` lock at `29–31 Hz`). |
| **Sitting 1** *(broken pipeline)* | `151.4 s`, `15` blink cuts | Froze at `55%` on startup (`67%` after clearing) | **100% Center** (`0.486–0.493`) | `15/15` | 30 Hz `availableCameras()` + `validationStatus` storm starved React; 1-frame startup `face.talking` froze `55%`; `0.7*iris + 0.3*yaw` pinned gaze at Center. |
| **Sitting 2** *(calibrated, exported above)* | **`205.5 s`**, **`366` keyframes** (`308` `breathRate` msgs) | **`63%` 5-plate avg** (`63.9%` trace mean, `37–85%`) | **`91` Left / `235` Center / `40` Right** | **`11/15`** (`3,3,1,1,3`) | Cached camera list, deduplicated status broadcasts, `>= 5`-frame talking guard, OLS detrending, additive iris+yaw deviation (`0.95 / 0.55`). `26` raw blinks → `11` early ripples + `15` cuts. |

<p align="center">
  <img src="./web/public/contact-sheet-run1-center-locked.png" alt="Sitting 1 Contact Sheet showing 100% solid blue Center gaze bars prior to additive iris+yaw fix" width="760" />
</p>
<p align="center"><em>Sitting 1 (151.4 s) before the additive iris + yaw fix: all five bottom gaze bars are flat cobalt Center. Compare with Sitting 2 at the top (91 Left / 235 Center / 40 Right).</em></p>

---

## Consent, Privacy & Presage §7.4 Disclosure

- **Camera stays off until explicit consent:** Video capture never opens until you check consent and start capture on `/calibrate` (with warm serialized bridge reuse cleanly across `/calibrate` → `/experience`).
- **No raw frames or audio stored:** Native Node captures at `960×540 @ 30fps` locally (`127.0.0.1:4199`), drops every frame immediately from memory, and streams only normalized `[0..1]` silhouette coordinates and scalar metrics over localhost WebSocket. Microphone permission is never requested.
- **SDK telemetry OFF & `requestInsight()` unused:** `bridge/server.mjs` constructs `SmartSpectraSDK` with `enableTelemetry: false` and never invokes `sdk.requestInsight()`. Both invariants are asserted automatically by tests and CI.
- **Accurate Presage §7.4 LLM Insights disclosure:** `cardioMetrics` stays **OFF by default**, requesting only `faceMetrics + breathingMetrics` so pulse and HRV are never computed or buffered. Per Presage's [LLM Insights docs](https://smartspectra.presagetech.com/docs/llm-insights) and Privacy Policy §7.4, when breathing (`breathing.rate`) or cardio metrics are active, the SDK automatically dispatches buffered derived numeric series (never video) to Presage's Analytics Gateway / Anthropic LLM service and cannot currently be turned off by developers; this behavior is disclosed inline on `/calibrate`. Camera rPPG also degrades in dim lighting and darker skin tones (Fitzpatrick V–VI), so opt-in pulse readings under `40%` confidence are suppressed (`null`).
- **One-click erasure:** Trace recording only runs when manually triggered, and `/contact-sheet` provides one-click in-memory erasure (`Erase Session Data`).

---

## Quickstart & Verification

### 1. Local Live Webcam (`Node.js >= 20`, Windows / macOS / Linux)

```bash
npm install
npm --prefix web install

cp .env.example .env
# Edit .env -> SMARTSPECTRA_API_KEY=...

npm run check   # Runs 20 SignalProcessor unit tests, trace/privacy verifier, and frontend build
npm start       # Starts local SmartSpectra WebSocket bridge + static UI on http://127.0.0.1:4199
```

Useful diagnostics:

```bash
npm run cameras                                            # Enumerate native cameras (no key required)
npm run spike -- --skip-readiness --seconds 20             # Inspect 1 Hz SmartSpectra metrics in terminal
node bridge/server.mjs --record recordings/sitting.jsonl   # Record sanitized signal frames to JSONL
npm run verify-trace                                       # Assert all counts & 4.2s blink gate math on sample-trace.json
```

### 2. Interactive Hosted Preview (Vercel)

Live deployment: **https://afterimage-presage.vercel.app**

Because `@smartspectra/node-sdk` is a native desktop C++/FFI addon, browsers cannot run it directly. When `127.0.0.1:4199` is absent, [vercel.json](./vercel.json) serves the SPA directly into **Recorded Sample Trace** mode (`366` keyframes from [`web/public/sample-trace.json`](./web/public/sample-trace.json) at 1× pace) plus **Keyboard Interactive** mode (`Space` = Blink Cut, `←/↑/→` = Gaze, `Shift` / slider = Breath).

---

## Architecture & Empirical Notes

- [`bridge/signal-processor.mjs`](./bridge/signal-processor.mjs) — Scale-invariant EAR blink-on-reopen (`< 650 ms`), `1.1 s` long-blink pause, `>= 5`-frame talking onset & `900 ms` hold guard, additive iris+yaw deviation gaze (`91 / 235 / 40`), `4.5 s` OLS-detrended chest-breath steadiness, calibrated `SAD` echo EMA, confidence-gated (`>= 40%`) opt-in pulse, and `[0..1]` silhouette extraction.
- [`bridge/server.mjs`](./bridge/server.mjs) — Serialized-mutex localhost HTTP + WebSocket bridge with cached camera enumeration, deduplicated `(validation, validationHint)` broadcasts, `enableTelemetry: false`, and JSONL / `sample-trace.json` recording.
- [`scripts/verify-trace.mjs`](./scripts/verify-trace.mjs) — Deterministic verifier checking every published trace count (`366` frames, `91 / 235 / 40`, `63.9%` avg, `26 → 11 / 15` blinks, `308` breath rates) and privacy invariants (`enableTelemetry: false`, no `requestInsight()` calls), run on every push in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).
- [`docs/SDK-NOTES.md`](./docs/SDK-NOTES.md) — Detailed engineering notes covering all 8 Windows hardware/SDK findings and §7.4 verification.

---

## Honest Limits

- Tested by one participant (`@emarc99`) on a single Windows x64 laptop webcam (`USB\VID_13D3&PID_5415`) in indoor room lighting; not yet tested on macOS, Linux, or across Fitzpatrick V–VI skin tones.
- Because Sitting 2 was read silently, `talking` was `false` across all `366` keyframes in `sample-trace.json`; the `>= 5`-frame speech guard is verified via Sitting 1's startup bug diagnosis and unit tests rather than a spoken trace.
- No wire-level TCP packet capture was run against Presage's Analytics Gateway; Consent disclosures state strictly what `@smartspectra/node-sdk@3.5.0` source code and Presage's docs specify.

---

## Themes & Non-Medical Notice

Switch between **Monograph**, **Solar Coral**, and **Botanical** in the navbar at any time across `/`, `/calibrate`, `/experience`, and `/contact-sheet`. AFTERIMAGE is an interactive digital art and narrative experiment offered for creative and informational purposes only; it is not cleared by the FDA and does not diagnose, treat, cure, or prevent any disease.

MIT — see [LICENSE](./LICENSE).
