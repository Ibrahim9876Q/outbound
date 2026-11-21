# Claude lane progress

## Regression checks (re-run every iteration)
- `curl -s localhost:4317/api/state` is valid JSON with apps
- Headless screenshot at 1280×800 and 1920×1080: no horizontal scroll, laptop fully visible
- No console errors from my files (common.js / computer.js)

## Iteration 0 — 16:44 Sat Nov 21
- Wired index.html for all lanes (computer.css, globe.css, phone.css, phone.js, #view-phone), enabled Phone tab. Committed 839d6f5.

## Iteration 1: 16:50–17:00
Goal: laptop with live mic key + webcam, then desktop icons, then wires (AGENT_PROMPT §12.3).
Files: style.css, common.js, computer.js, computer.css, index.html (feed-card class, favicon).
Verify: headless Chrome via CDP (scratchpad shot.mjs) at 1280×800 + 1920×1080; test-only preload
(scratchpad sim-devices.js) patches the SSE payload to simulate mic+camera so I never touch real devices.
Result: everything renders; no JS errors (only 404s for other lanes' unmerged files). Commit a0563c7.
Fixed along the way: [hidden] overridden by display rules; shared-company labels piling up (now one
curve per app pair + collision-free labels, max 4 when nothing is selected); deck too tall.

## Iteration 2: 17:00–17:10
- flagHtml(): Windows can't draw flag emoji → canvas check, fallback to "US" badge (.cc).
- Selected app's companies jump to the front of the internet strip; side panel scrolls to details.
- Short screens (≤880px tall): compact mic/camera cards.
- Perf: packets on their own SVG layer; removed shared dash animation and taskbar blur.
  Headless software render 1920×1080: 35 → 49 fps, worst frame 189 → 67 ms; heap flat over 20s; 722 DOM nodes stable.
- Desktop eviction: fresh apps (first seen < 90s) outrank idle icons so "open an app, watch it appear" works.

Rubric (1–5): Truthful 5 · Works live 4 (mic/cam verified with simulated payload only; real device test needs user OK)
· Readable 4 · Wow 4 · Demo-ready 3 (no spotlight button yet) · Perf 4 · Code 4.
- Demo-ready < 4: no spotlight, no high-contrast toggle yet → next iteration.
Next: spotlight button + high-contrast toggle; real mic/camera check (ask user); new-app appearance test.

## Iteration 3: 17:01–17:05
- Demo spotlight button (+ S key): cycles camera user → mic user → app with most companies → tracker →
  local app↔app link → shared company, selecting the app and showing a plain-English caption on screen. 6.5s/step.
- High-contrast toggle (◐ in top bar, H key, remembered per browser): black screen, thicker wires, boxed names.
- Shared links via hosting/CDN/OS companies (Cloudflare, Akamai, AWS, Google Cloud, Microsoft…) only drawn when
  one of the two apps is selected: removes ~90% of dashed-curve noise. 1920×1080 now 3 shared wires vs dozens.
- "Unknown app (PID N)" ghosts rank below every named app and never get the fresh-app boost.
Verified: spotlight caption "Google Chrome sends data to 11 companies in 4 countries" + focus; HC screenshot.
Rubric: Truthful 5 · Works live 4 · Readable 4 · Wow 4 · Demo-ready 4 · Perf 4 · Code 4.
Step-back: if the demo were in 10 min, fix = verify real camera/mic live (needs user OK), then "new app appears" live.

## Iteration 4: real-device test (user approved camera + mic)
- Windows Camera app is NOT installed on this PC (`start microsoft.windows.camera:` opens a "Pick an app" dialog).
- Held the real webcam (USB2.0 HD UVC WebCam, 8s) and mic (Realtek array, 9s) via getUserMedia from Chrome
  launched by a script (headless and visible). Both devices opened, but Windows wrote NOTHING to
  CapabilityAccessManager (latest webcam entry still May 2, mic entry Nov 19), so the server never saw them.
  → UI path still verified only with the simulated payload. Needs a real app the user drives (Discord call,
    Teams, or a webcam test page in their normal Chrome) while watching /api/state.

## Iteration 5: 18:36, camera light (user request)
User: the drawn webcam must never use the real camera; when the camera is in use it should be a
"blinding light", purely UI. (Outbound never calls getUserMedia; it only reads Windows' usage registry.)
- White-hot LED with layered green halo, 60cqw glare + horizontal lens-flare streak over the bezel,
  light spill washing over the top of the screen (.laptop.cam-on), REC label on a dark pill.
- Turn-on burst: glare scales to 2.8× and 1.8× brightness, then settles (skipped with reduced motion).
Verified with simulated payload screenshots at 1280×800 and 1920×1080.

## Iteration 6: 18:55, orchestrator brief: B&W cybersecurity theme + 2 fixes
- style.css rewritten around shared tokens (--bg/--fg/--muted/--dim/--line/--grid/--mic/--tracker/--font-mono …),
  pure black + 1px grid + subtle scanlines, mono uppercase headings, square cards with corner brackets,
  blinking cursor after OUTBOUND. Tokens documented in notes/claude-REQUESTS.md.
- computer.css rewritten monochrome: grey/white wires, bright white local wires, dashed grey shared, red trackers,
  orange mic, white camera light/flash/rings. Icons grayscale unless selected or using mic/camera.
- Big MIC / CAM keycaps (2.6 units wide, taller, white outline, icon + "MIC"/"CAM" + state).
- Feed lines type themselves out with a block cursor (skipped with reduced motion).
- Phone tab is a link to http://127.0.0.1:4320/ (new tab, rel=noopener).
- 1280 top bar no longer clips; deck captions shortened to "● MIC: <app>" / "Mic muted".
Verified: screenshots 1920×1080 idle + 1280×800 simulated mic/cam; Phone link href/target checked; no JS errors.
Process: requests now go in notes/claude-REQUESTS.md; don't merge other branches.
