# Cross-lane requests

## Globe → Computer and shared files

- Resolved on `master`. The shared index links `globe.css` after `style.css`. The globe subscribes through `window.Outbound.onState(callback)`, follows `#view-globe.hidden`, and picks up `body.hc` toggles.
- The globe keeps a direct `EventSource('/events')` fallback for the standalone lane. After combining the branches, the shared script opens the only SSE connection.
