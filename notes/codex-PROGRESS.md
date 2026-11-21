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

## Iteration 2 · November 21, 2026, 5:03 PM EST

Integrate with the shared tab and state API now on `master`. Keep the fallback for standalone Globe branch work.
Check the shared files using browser-only overrides, test unplaced destinations, and measure idle CPU.

- Chrome overlaid the shared files from `1417abc` on the live local app. Computer → Globe → Computer → Globe worked with exactly one SSE connection. The shared contrast toggle, app filtering, keyboard country focus, destination details, reduced motion, and both desktop sizes passed.
- An isolated browser fixture covered empty snapshots, missing and zero coordinates, overlapping destination points, tracker routes, and stable DOM and arc objects when only the timestamp changes.
- Node used 0.875 CPU seconds in a 10.09-second idle sample, or 0.525% of total host CPU. Browser hidden-view pause passed. Phone files are handled in another lane and returned 404 in this overlay.
- Rubric for this lane, in order. **5 / 4 / 4 / 4 / 4 / 4 / 4**.
