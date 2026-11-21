# Backend progress

## Iteration 1 · 2026-11-21 16:47 EST

Make the live network feed reliable. Check the server, Windows collectors and npm entry point.
Verify JSON, SSE, globe assets and localhost connections on port 4319. Check reported TCP counts against the eligible socket rows.

- Implemented eligible socket counting, reciprocal localhost matching and shared-link activity. Moved enrichment off the first socket scan, added the npm start command and tightened local HTTP handling.
- Live checks passed for the JSON and SSE endpoints, an attributed external destination, all four globe assets and an observed curl-to-Node link. The fixture covered close-wait filtering, mapped IPv4, same-port IPv6 listeners and closed shared links.
- Scores (1–5) for truthful / works live / readable / wow / demo-ready / performance / code quality: **4 / 3 / 2 / 2 / 2 / 3 / 4**. Device transitions and a ten-minute run are pending. Browser presentation and rehearsal need the frontend assets. Backend CPU has yet to be sampled.
- Next, verify device session accounting and live registry access.

### Regression checks

- Serve JSON, SSE and all four globe assets from 127.0.0.1:4319. Count only eligible sockets, pair reciprocal loopback rows and mark shared links inactive when one app disconnects.

## Iteration 2 · 2026-11-21 16:58 EST

Read microphone and webcam concurrently and use Windows start and stop times for completed sessions.
Verify first-run history, short sessions, restart deduplication, midnight, concurrent app usage and live idle reads.

- Imported completed sessions from both Windows privacy keys, saved updates atomically and counted overlapping use once. Active entries expose the app ID documented in `notes/REQUESTS.md`.
- Live Windows state and SSE passed. Fixture checks passed for short sessions, actual stop timestamps, midnight overlap, concurrent use, failed reads and deduplication on restart. Live hardware activation requires permission.
- Scores (1–5) for truthful / works live / readable / wow / demo-ready / performance / code quality: **5 / 3 / 2 / 2 / 2 / 3 / 4**. Registry transition fixtures cover the device behavior. Live hardware, UI and ten-minute verification are pending.
- Next, finish demo and submission docs. Run the backend soak during drafting.

### Regression checks

- Confirm a missing stop value does not imply device use and a failed read preserves the last observation. Verify exact completed-session times, clipping at midnight, union of overlapping usage and idempotent reload from disk.

## Iteration 3 · 2026-11-21 17:01 EST

Write the three submission docs and capture the Computer view from the committed frontend with live test connections.
Check the timing and Wi-Fi fallback, then record the ten-minute health and CPU results.

- Wrote the README and its three setup commands, the timed walkthrough with live Wi-Fi fallback and the Devpost draft with the CBC source and privacy approach.
- Used a read-only preview of the Computer and Globe lane files with data scoped to the observed curl-to-Node connection. Both views rendered at 1280×800 and 1920×1080 without JavaScript exceptions or horizontal overflow. The preview returned 404 for the separately owned phone CSS and JS. Captured the README screenshot from the 1920×1080 view.
- The same Node process passed the ten-minute health run with 28 successful API requests. The ten-second idle sample recorded 0.00% Node CPU at Windows timer resolution. Working set went from 334.3 to 335.8 MiB.
- Opened example.com from curl and confirmed that the new Windows HTTPS destination had both a country and an attributed owner.
- Scores (1–5) for truthful / works live / readable / wow / demo-ready / performance / code quality: **5 / 4 / 4 / 4 / 4 / 4 / 4**. The timed walkthrough and device hardware cues still need a rehearsal on the merged app.
- After three iterations, the highest remaining demo risk is rehearsing the live handoff between Computer, device preview and Globe with the merged frontend. The backend preview can verify the contract independently.

## Iteration 4 · 2026-11-21 18:26 EST

Push state immediately after an activity event and reserve Node worker capacity for serving local assets during slow DNS.
Verify the first SSE state after a new connection contains the active peer link.

- A live curl-to-Node link emitted the event and its updated state less than 400 ms apart. The network fixture confirmed that two pending resolver calls leave capacity available and that subsequent polls resume queuing lookups when a slot frees up.
- Re-ran the API, SSE, asset, network and device fixture checks on the final backend. The final ten-second idle sample recorded 0.00% of one core at Windows timer resolution. The permission-gated mic/camera check and rehearsal from the merged checkout remain open.
- Scores (1–5) for truthful / works live / readable / wow / demo-ready / performance / code quality: **5 / 4 / 4 / 4 / 4 / 4 / 5**. The immediate state update closes the visible lag between the activity event and its corresponding wire.

### Regression checks

- Confirm the new-link SSE event is followed by state with an active reciprocal link. Confirm slow reverse DNS calls leave at least two worker threads available with the default Node worker pool.

## Loop round 2 · 2026-11-21 18:57 EST

- Retried process discovery in a single batch when active TCP rows reference missing PIDs. Documented the Computer lane's observation that some browser capture paths bypass the Windows privacy timestamps.
- A fixture recovered a process absent from the first tasklist snapshot. Restarted on 4319 and verified the live state endpoint and unchanged top-level keys. No state fields changed.
- Left the pre-existing untracked audio and camera probe scripts outside this change.
