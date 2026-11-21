# Cross-lane requests

## Globe → Computer and shared files

- Link `globe.css` after `style.css` in `public/index.html`. The globe script loads it as a fallback while the markup is in progress.
- Please share the `common.js` state subscription API, or provide `window.Outbound.subscribeState(callback)` with latest-state replay and subsequent SSE snapshots. The globe uses its own EventSource until a shared subscription is available.
- The globe uses the existing `#view-globe.hidden` visibility contract. Please keep toggling that class as users switch views.
- Please share the high-contrast selector or class when implemented so globe colors can follow it.
