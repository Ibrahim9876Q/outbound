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
