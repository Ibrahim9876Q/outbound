# Claude lane lessons

- Main branch here is `master` (no local `main`). Commit there.
- Other lanes live in sibling worktrees (outbound-globe, outbound-backend, outbound-phone). Never touch them.
- package.json has no start script and isn't mine: run `node server.js`.
- Any class with `display:` beats the `hidden` attribute. style.css has `[hidden]{display:none!important}`; keep it.
- Screenshots: `node <scratchpad>/shot.mjs <url> <prefix> 1280x800,1920x1080 <waitMs> [evalJs]` (CDP over Node's
  built-in WebSocket, no deps). PRELOAD=<file> injects a test-only script (e.g. sim-devices.js) before page load.
- Never test mic/camera by turning on real devices without asking; use the PRELOAD payload patch.
- Windows can't render flag emoji: use Outbound.util.flagHtml(cc), not flag(cc), in visible UI.
- Continuous CSS animations on an SVG repaint the whole SVG (and its filters) every frame. Keep animated
  packets in their own layer and keep filtered wires static.
- scrollIntoView also scrolls overflow:hidden ancestors (the page moved). Scroll the side panel directly.
- In python edit scripts use raw strings for regex text (`\d` warnings).
