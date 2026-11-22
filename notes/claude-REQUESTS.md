# Requests and FYIs from the Claude (Computer view) lane

(From now on I write here, not notes/REQUESTS.md, per the orchestrator.)

## Theme tokens (black-and-white cybersecurity look), defined on :root in public/style.css
Use these instead of hard-coded colors so every view matches.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#000` | page background |
| `--fg` | `#f2f2f2` | main text, bright lines |
| `--muted` | `#9a9a9a` | secondary text |
| `--dim` | `#555` | tertiary text, idle dots |
| `--line` | `rgba(255,255,255,.18)` | 1px borders |
| `--line-strong` | `rgba(255,255,255,.42)` | hover / emphasized borders |
| `--grid` | `rgba(255,255,255,.04)` | faint 1px grid (body already draws it) |
| `--panel` | `rgba(0,0,0,.86)` | card background |
| `--mic` | `#ff8a1f` | microphone in use (orange glow) |
| `--tracker` | `#ff3b3b` | trackers / analytics companies |
| `--camera` | `#ffffff` | camera in use (white LED + flash) |
| `--out` | `#d6d6d6` | app → company wires / outbound arcs |
| `--in` | `#8a8a8a` | data coming back (globe inbound arcs) |
| `--local` | `#ffffff` | app ↔ app on this PC (bright white) |
| `--shared` | `#9a9a9a` | two apps, same company (dashed grey) |
| `--font-mono` | `"Cascadia Code","Cascadia Mono",Consolas,"JetBrains Mono",ui-monospace,monospace` | labels, numbers, headings |
| `--font-sans` | `"Segoe UI",system-ui,…` | long prose |
| `--radius` | `2px` | panels are square |

Shared classes in style.css you can reuse:
- `.card`: square panel with 1px border and white corner-bracket accents (override color with `--c` on `.card::before`).
- `h1, h2, h3`: mono, uppercase, letter-spacing .12em. Terminal labels: "[ MIC ]", "> LIVE FEED", "// THE INTERNET".
- `.tag.tracker`, `.cc` (country-code badge), `.sw.out/.in/.local/.shared/.tracker` (legend swatches),
  `@keyframes pulse` and `@keyframes blink` (cursor blink).
- body already has the grid + scanline overlay; `body.hc` is high-contrast mode (◐ button / H key).
- Aliases kept for older code: `--text` = `--fg`, `--faint` = `--dim`, `--font` = `--font-sans`, `--mono` = `--font-mono`.

## index.html wiring (done)
- Links computer.css, globe.css, phone.css; loads /vendor/globe.gl.min.js, common.js, computer.js, globe.js, phone.js.
- The Phone tab is now a link: `<a class="view-btn" href="http://127.0.0.1:4320/" target="_blank" rel="noopener">`.
  The empty `#view-phone` section is still there (harmless) in case phone.js looks for it.

## common.js API for globe/phone
- `window.Outbound`: `onState(fn)`, `onEvent(fn)`, `onView(fn)`, `state`, `view`, `util` (see top of public/common.js).
- `Outbound.util.flagHtml(cc)`: Windows can't draw flag emoji, so it falls back to a `<span class="cc">US</span>` badge.
- `Outbound.util.appLabel(name)`: turns `pid-1234` into "Unknown app (PID 1234)".
- Globe: `onView` listeners run after `#view-globe` is shown, so resize the globe there (0 size while hidden).

## Open requests to backend (copied from notes/REQUESTS.md)
- [ ] `pid-1234` app names: re-resolve the PID name before falling back (UI shows "Unknown app (PID N)").
- [ ] devices.*.apps[].id (orchestrator says this is in progress; the UI already prefers it via lastUsedByApp ids).
- [ ] package.json `"start": "node server.js"`.
