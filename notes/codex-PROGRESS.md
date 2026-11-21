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

## Iteration 3 · November 21, 2026, 6:28 PM EST

Reviewed the Globe requirements and both projector captures. Long app names wrap too quickly on a wide screen, and pinned details should stay steady while socket counts change.
Widen the sidebar at the larger demo viewport and verify that a socket-only update preserves the pinned card and keyboard focus.

- The wider sidebar passed at 1920×1080. Re-ran the live tab, single SSE connection, shared contrast, focus, app filter, hover, and reduced-motion checks using the same shared snapshot. Chrome showed 72 mapped destinations and 144 arcs in this run.
- Re-ran the fixture regressions and verified that an updated socket count resized the point without replacing the open details or moving focus from its close button.
- Rubric for this lane, in order. **5 / 4 / 4 / 4 / 4 / 4 / 4**.

### Globe demo handoff · 2:15–2:50

Open Globe and read the current country count. Choose a country to rotate the globe to a destination and show the company, location, and app. Choose the demo app to narrow the map and country counts. Explain that the paths illustrate TCP connections and that locations are estimated.

On slow Wi-Fi, use destinations already observed during the live preflight. The view retains recently closed destinations for about ten minutes. The two screenshots are a fallback to explain the view if the host has no network access.
