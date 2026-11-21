# Globe progress

## Iteration 1 · November 21, 2026, 4:47 PM EST

Build the live map and sidebar in `public/globe.js` and `public/globe.css`.
Verify rendered state against the server on port 4318, stop rotation on interaction, and check the filter and destination details.

- Live Windows state through the fallback SSE feed. Chrome rendered 71 mapped destinations as 142 arcs. Both textures loaded. Sidebar totals matched destinations, and filters, hover, click, close, rotation stop, and reduced motion passed.
- Captured both desktop viewport sizes. At 390px the isolated map fits the viewport. The branch still lacks the shared stylesheet, tab controller, and Computer script, so the browser check opened the Globe section directly. The console contained only requests for the three missing shared files.
- Rubric for this lane, in order. **5 / 4 / 4 / 4 / 3 / 3 / 4**. Demo integration remains pending on the shared branch. The next pass will measure idle CPU and test no-coordinate and empty snapshots.

### Regression checks

- Inspect the browser console for Three.js color warnings, check two arcs per mapped destination, and verify Windows displays the offline flag image.
- Check the map at 1280×800, 1920×1080 and 390px wide. Confirm app filtering, destination hover and pinning, motion controls, and hidden-view pause.
