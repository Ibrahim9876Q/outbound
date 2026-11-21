# Cross-lane requests

Write requests for files you don't own here. Format: `- [ ] (from → to) request`.

## From Claude (Computer view)
- FYI all lanes: index.html already links computer.css, globe.css, phone.css and loads
  /vendor/globe.gl.min.js, common.js, computer.js, globe.js, phone.js (in that order).
  The Phone tab is enabled and renders into an empty `<section class="view hidden" id="view-phone">`.
- FYI all lanes: common.js API is documented at the top of public/common.js (window.Outbound).
- [ ] (Claude → backend) Many apps show up as `pid-1234` (tasklist didn't list that PID, often short-lived
  child processes). Could network.js re-read the PID's name (e.g. from procinfo.ps1's Id, or a one-off
  `tasklist /fi "PID eq N"`) before naming it `pid-N`? The UI shows these as "Unknown app (PID N)" meanwhile.
- [ ] (Claude → backend) `devices.<kind>.apps` only has `{ app: label, since }`. Adding the exe/package `id`
  (same as lastUsedByApp ids) would make mic/camera ↔ network-app matching exact.
- [ ] (Claude → backend) package.json has no `"start": "node server.js"` script (AGENT_PROMPT §4 asks for one).
- FYI globe/phone: use `Outbound.util.flagHtml(cc)` for flags; Windows can't draw flag emoji, so it falls back to
  a `<span class="cc">US</span>` badge (styled in style.css). Use `Outbound.util.appLabel(name)` for app names
  (turns `pid-1234` into "Unknown app (PID 1234)").
- FYI globe: common.js toggles `.hidden` on `#view-globe` and calls `Outbound.onView(fn)` listeners after the
  switch, so call `globe.width(...)/height(...)` there (the container has 0 size while hidden).
- [ ] (Claude → backend) FYI: getUserMedia from a script-launched Chrome (headless or visible) used the real
  webcam and mic without Windows writing CapabilityAccessManager LastUsedTime*, so devices.js never saw it.
  Normal apps (Discord, Claude, Resolve) do get logged. Worth noting as a known limit in the UI footnote / README.


## Globe → Computer and shared files

- Resolved on `master`. The shared index links `globe.css` after `style.css`. The globe subscribes through `window.Outbound.onState(callback)`, follows `#view-globe.hidden`, and picks up `body.hc` toggles.
- The globe keeps a direct `EventSource('/events')` fallback for the standalone lane. After combining the branches, the shared script opens the only SSE connection.


- `devices.mic.apps[].id` and `devices.camera.apps[].id` now expose the lowercase Windows executable or package ID for each active app. Match it against `apps[].id` first, then use the existing `app` label for a name match. The fields appear in both `/api/state` and the SSE `state` payload.


## Desktop navigation

Enable the Phone tab in `public/index.html` and make it navigate to the standalone Phone dashboard at `http://127.0.0.1:4320/`. Clear the “soon” label and avoid dispatching Phone to the in-page Computer/Globe tab handler. The gateway owns the Phone page and links back to `http://127.0.0.1:4317/`.


Write requests for files you don't own here. Format: `- [ ] (from → to) request`.

## From Claude (Computer view)
- FYI all lanes: index.html already links computer.css, globe.css, phone.css and loads
  /vendor/globe.gl.min.js, common.js, computer.js, globe.js, phone.js (in that order).
  The Phone tab is enabled and renders into an empty `<section class="view hidden" id="view-phone">`.
- FYI all lanes: common.js API is documented at the top of public/common.js (window.Outbound).
- [ ] (Claude → backend) Many apps show up as `pid-1234` (tasklist didn't list that PID, often short-lived
  child processes). Could network.js re-read the PID's name (e.g. from procinfo.ps1's Id, or a one-off
  `tasklist /fi "PID eq N"`) before naming it `pid-N`? The UI shows these as "Unknown app (PID N)" meanwhile.
- [ ] (Claude → backend) `devices.<kind>.apps` only has `{ app: label, since }`. Adding the exe/package `id`
  (same as lastUsedByApp ids) would make mic/camera ↔ network-app matching exact.
- [ ] (Claude → backend) package.json has no `"start": "node server.js"` script (AGENT_PROMPT §4 asks for one).
- FYI globe/phone: use `Outbound.util.flagHtml(cc)` for flags; Windows can't draw flag emoji, so it falls back to
  a `<span class="cc">US</span>` badge (styled in style.css). Use `Outbound.util.appLabel(name)` for app names
  (turns `pid-1234` into "Unknown app (PID 1234)").
- FYI globe: common.js toggles `.hidden` on `#view-globe` and calls `Outbound.onView(fn)` listeners after the
  switch, so call `globe.width(...)/height(...)` there (the container has 0 size while hidden).
- [ ] (Claude → backend) FYI: getUserMedia from a script-launched Chrome (headless or visible) used the real
  webcam and mic without Windows writing CapabilityAccessManager LastUsedTime*, so devices.js never saw it.
  Normal apps (Discord, Claude, Resolve) do get logged. Worth noting as a known limit in the UI footnote / README.
