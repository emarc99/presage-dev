# Windows Hardware & `@smartspectra/node-sdk@3.5.0` Engineering Notes

All measurements below were observed on Windows x64 (`Node v24.9.0`, integrated laptop camera `USB\VID_13D3&PID_5415` at `960×540 @ 30fps`) while calibrating AFTERIMAGE across three full live sittings (`Sitting 1`: `151.4 s`; `Sitting 2`: `205.5 s`, `366` keyframes silent; `Sitting 3`: `239.2 s` exported essay / `352.4 s` narrated capture, `670` keyframes saved in [`web/public/sample-trace.json`](../web/public/sample-trace.json)).

---

## 1. Windows Camera Enumeration (`CameraSelection.front` vs. `CameraSelection.default`)
- Windows MediaFoundation reports integrated laptop cameras with `facing="unknown"` and `lensType="unknown"`.
- Passing `CameraSelection.front` fails immediately with `kInputUnavailable`.
- Passing `CameraSelection.default` or `CameraSelection.byId(id)` at `960×540 @ 30fps` locks steadily at `29–31 Hz` without hitting `kSustainedLowFrameRate` (error `14`).

## 2. `sdk.checkDeviceReadiness()` Teardown & 30 s Stall
- Calling `sdk.checkDeviceReadiness()` destroys any active session and runs a separate 30-second `reference720p30('full')` benchmark before returning.
- Starting `useCamera(..., { width: 960, height: 540, fps: 30 })` directly transitions cleanly through SDK framing hints (`kChestNotVisible` → `kTooDark` → `kFaceTooHigh` → `kOk`) and hits `kRunning` in ~7 seconds.

## 3. Raw Pixel `face.landmarks` (`[316..564, 10..350]`), Not Normalized `[0..1]`
- Unlike browser MediaPipe packages that output `[0..1]` landmarks, `@smartspectra/node-sdk` outputs all 478 `face.landmarks` (including iris centers `468` and `473`) in raw frame pixel coordinates (`x=[316.0..564.0], y=[10.0..350.0]` at `960×540`).
- `computeMeanEar`, `computeGazeScalar`, and `extractSilhouette` in [`bridge/signal-processor.mjs`](../bridge/signal-processor.mjs) divide by local eye-corner width (`33↔133`, `263↔362`), cheek span (`234↔454`), and face-oval bounds so downstream scores remain scale-invariant.

## 4. MediaFoundation Auto-Exposure Collapse & OLS Linear Detrending on `breathing.upperTrace`
- On laptop USB camera drivers without manual AE lock or gain registers, SmartSpectra's exposure lock collapsed image luma (`luma=18.8254 vs pre-lock 81.3485`) and logged `mediafoundation_camera_source.cc:3019 [exposure-topup] ... exposure reverted to AUTO`.
- Active auto-exposure adjustments combined with subtle posture lean drove a slow baseline ramp across `[-6.842..+3.256]` over 10 seconds in `breathing.upperTrace`.
- Fitting Ordinary Least Squares (OLS) linear regression over a rolling `4.5 s` window removes the linear ramp without damping respiratory oscillation or `breathPhase` (`[-1..1]`).

## 5. `breathing.upperTrace.stable` Lags Behind `breathing.rate` (~20 s Warmup)
- `breathing.upperTrace` emits valid 30 Hz chest displacement samples within ~2 seconds of `kRunning`, while its `stable` flag waits behind `breathing.rate` warmup (20+ seconds).
- Computing 2nd-difference curvature RMS (`d2Rms / d1Rms` and `d2Rms / std`) directly on the detrended `4.5 s` `upperTrace` buffer lets optical de-haze respond from second 2 instead of stalling behind a 20 s loader.

## 6. Blink-on-Reopen (`< 650 ms`, `EAR < 0.21`) vs. Long-Blink Pause (`>= 1.1 s`) + `4.2 s` Shutter Dwell
- Live open-eye baseline measured across captures sat at `ear ≈ 0.298–0.313`.
- Emitting cuts on eyelid *drop* misfires at the start of an intentional `1.1 s` pause-eyes closure. AFTERIMAGE records onset when `ear < 0.21`, suppresses native `face.blinking` pulses once closed `>= 400 ms`, emits `blinkCut` only **on reopen** (`< 650 ms`, `360 ms` debounce), and gates scene advancement on a per-beat **`4.2 s` Shutter Armed** timer (`SHUTTER_ARM_MS = 4200`).
- Replaying Sitting 2 (`sample-trace.json`) verifies the split: **`26`** total `blinkCut` events → **`11`** suppressed early reading blinks (`< 4.2 s`) + **`15`** armed beat/scene cuts (`26 - 11 = 15`).

## 7. Additive Iris + Yaw Deviation Unlocking Multi-Zone Gaze (`91 / 235 / 40`)
- In Sitting 1, weighted averaging (`0.7 * iris + 0.3 * yaw`) damped horizontal glances across a 14" laptop display (`gazeScalar` stayed between `0.486` and `0.493`, leaving every Contact Sheet card 100% solid `center`).
- Switching to additive deviation around neutral center (`0.5 + irisDelta * 0.95 + yawDelta * 0.55`) with `< 0.455 / > 0.545` entry thresholds (`0.478 / 0.522` return hysteresis) produced `91` left, `235` center, and `40` right keyframes across `205.5 s` in Sitting 2.

## 8. 30 Hz `validationStatus` Storm, Startup `face.talking` Flickers & Resting `SAD` Skew
- `validationStatus` fires on every video frame (~25–30×/sec) even when `(validation, validationHint)` is unchanged. Calling `SmartSpectraSDK.availableCameras()` inside status builders caused ~30 Windows MediaFoundation enumerations/sec until cached (10 s TTL) and change-filtered.
- Reusing the warm bridge stream across `/calibrate` → `/experience` and throttling continuous UI commits to `~12.5 Hz` (`80 ms`) eliminated 60 Hz SVG `feGaussianBlur` thrash.
- A single-frame `face.talking: true` flicker during startup initially froze breath clarity at `55%`; gating speech hold on `talkingOnsetFrames = 5` (`900 ms` hold) and never freezing prior to `hasComputedBreath` resolved it.
- Downward laptop camera angles also produced resting `SAD: 64.1%–97.6%`; `0.90/0.10` EMA smoothing with an `>= 86%` `heavy` gate keeps neutral reading steady until a sustained shift occurs.

## 9. Presage §7.4 Auto-Fired LLM Insights Behavior (SDK 3.5.0 Source & Docs)
- Inspection of `node_modules/@smartspectra/node-sdk/js/smartspectra.js` (`_ensureSession()`) shows every SDK session registers `onInsight`.
- Per [Presage's LLM Insights docs](https://smartspectra.presagetech.com/docs/llm-insights) and Privacy Policy §7.4, when `breathing` (including `breathing.rate`) or `cardio` metrics are enabled, the SDK automatically dispatches buffered derived numeric series (`breathing.rate`, plus `pulse`/`HRV` when cardio is enabled — never raw video) to Presage's Analytics Gateway / Anthropic LLM service, which cannot currently be disabled by developers.
- AFTERIMAGE keeps `enableTelemetry: false`, never calls `sdk.requestInsight()`, and keeps `cardioMetrics` **OFF by default** so pulse/HRV are never computed or buffered unless the user explicitly flips the toggle after reading the disclosure on `/calibrate`.

---

## 10. Sitting 3 Narrated Telemetry: 42 ms `face.blinking` Descent Race, `807 / 807` Talking Guard & Opt-In Pulse Suppression
- **Live speech guard verification (`807 / 807`, `0` violations):** Across `15` speaking episodes (`822` talking packets in the `9,827`-packet 30 Hz capture averaging `29.5 fps`, `57` keyframes in `web/public/sample-trace.json`), `breathSteadiness` stayed locked across all `807` consecutive talking-frame transitions with `0` drift violations.
- **42 ms eyelid-descent race (`dt = 289.947 s`):** Out of `4` deliberate `longBlinkPause` pauses (`157.86 s`, `259.14 s`, `291.11 s`, `320.69 s`), pause #3 revealed a race where SmartSpectra's native `face.blinking` fired at `dt = 289.947 s` (`ear = 0.213`, just `0.003` above `earBlinkThreshold = 0.21`) **42 ms before** `ear` dropped to `0.175` at `289.989 s` for a `2.44 s` closure (`longBlinkPause` fired at `291.114 s`, reopened cleanly at `292.424 s` with `ear = 0.253`). Fixed in [`bridge/signal-processor.mjs`](../bridge/signal-processor.mjs) by gating native `face.blinking` fallback on `lastEar === null || lastEar >= 0.25` (`nativeBlinkEarFloor`), verified by Regression Test #21 in [`bridge/signal-processor.test.mjs`](../bridge/signal-processor.test.mjs).
- **Live opt-in `cardioMetrics` confidence gating (`>= 40%`):** Toggled ON mid-sitting (`dt = 264.6 s` first confident reading `75.6 bpm`, `conf = 51`; `81` keyframes in `sample-trace.json`, `67.5–85.5 bpm`, `76.6 bpm` mean). On the exported `239.2 s` Contact Sheet PNG, Plates II–IV printed `71.8 / 77.1 / 77.2 bpm` (`AVG PULSE 75.4 BPM (§7.4)`), while Plate I (pre-toggle) and Plate V (extreme left glance dropping rPPG confidence below `40%`) stayed honestly suppressed (`null`).
