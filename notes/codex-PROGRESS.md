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

## Round 2 · November 21, 2026, 6:57 PM EST

- Reviewed the updated integration branch. The shared stylesheet now uses grayscale wire colors, so Globe defines its warm and cool legend swatches locally to match the route palette.
- Verified the scoped CSS against the route palette and ran JavaScript syntax and diff checks. This patch was checked statically.

## Black-and-white theme

- Merged the shared theme and preserved both lanes’ entries in the shared requests file.
- Replaced Earth imagery with a latitude and longitude grid. The routes, panels, and flag icons are grayscale. Tracker details use the shared red accent.
- Opened the merged Globe tab in headless Chrome on port 4318 and inspected a 1280×800 capture with live destinations.

## Monochrome land layer

- Added a grayscale land mask from the bundled Natural Earth geometry. The map still loads entirely offline.
- Disabled the library’s opening spin so the globe starts at home with routes visible. Verified recognizable North American coastlines, the grid, and live routes in Chrome at 1280×800.

## Dotted land and endpoint inspection

- `89350d2` adds the offline Natural Earth dataset and resolution-3 country cells. The first live check loaded 177 country features and drew 36 routes from eight observed apps.
- `1805708` adds expandable country rows with company names, live socket totals, and app names.
- `f7017e7` adds one-shot arrival pulses and socket-scaled points.
- `8ebd84c` adds terminal-style company, ASN, IP, location, app, and port details.
- Verified Chrome on port 4318 at 1280×800 and 1920×1080 with zero console errors. The preview supplied the existing Phone assets from `integration` as browser-only overrides. Live screenshots show the brighter destination cells. A separate browser fixture verified tracker red, socket scaling, a pulse that stays unchanged across socket updates, company expansion and collapse, and all endpoint fields on pointer hover.

## Country precision, headquarters, and data trail

- `0d53161` distinguishes locations estimated at country level with hollow dashed rings and approximate-location tooltip text.
- `6e7f454` adds a toggleable, offline table of 40 company headquarters and a separate dotted layer for reported network owners.
- `7746b64` adds a six-row data trail sorted by first observation time, using snapshots for city and company labels.
- Chrome on port 4318 passed at 1280×800 and 1920×1080 with no console errors. As in the previous round, the preview supplied the existing Phone assets from `integration` through browser-only overrides. A test snapshot verified distinct and stable IP offsets across socket updates, the same marker element after refresh, the country-only tooltip, headquarters link labels and toggle, and newest-first ordering capped at six rows.

## High-traffic Globe polish

- `0cea340` replaces the per-IP jitter with one logarithmically sized country marker, a count label, and an owner summary. Repeated country-estimate routes are grouped by app and route attributes.
- `6d1199e` fixes the enabled HQ toggle contrast, including on hover.
- `f2b512d` uses compact locations in the trail and moves the collapsed legend above Pause rotation.
- Chrome on port 4318 passed at 1280×800 and 1920×1080 with 270 observed destinations after opening Weather.com and zero console errors. The browser preview supplied the existing Phone assets from integration. A controlled 201-destination test verified aggregation, owner ordering, both trail formats, HQ toggle contrast, and legend disclosure. White dashed outlines stay visible over tracker-red cells.
