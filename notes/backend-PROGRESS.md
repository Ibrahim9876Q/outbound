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
