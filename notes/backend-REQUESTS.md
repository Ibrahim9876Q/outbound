# Backend requests

- xray4 UI: section 7 of `CONTRACT-v2.md` covers score factors and coverage, the 30-day history endpoint, research IDs, and retained-array totals. Show null score factors as unknown. Dossier links use an app ID or a `company:` prefix plus the canonical company name. Use the relevant totals to communicate truncated lists.

- xray3 scan panels: see section 6 of `CONTRACT-v2.md` for permissions, installed software, autoruns, extensions, and Windows privacy settings. Show null settings as unavailable. Continue polling while `appDataBackground` is true, even after status becomes done. Disable repeated scans during the continuation and label rows whose `partial` flag is true.

- Scan UI: `lastVisit` and `lastWrite` are Unix milliseconds. `summary` deduplicates sites and cookie domains across browser profiles. Site trackers are public dataset associations and can differ from requests made during the local visit.
- Stored-data lane UI: `GET /api/scan` may include `appDataTimedOut: true` when the app-folder scan reaches its time budget. Its file sizes and counts reflect the files visited. The `kinds` values count files by kind, and an app folder may exclude a nested app listed separately.
- Computer lane: the v2 Links view uses canonical `state.links` records with display-name endpoints. Existing desktop wires that expect executable IDs, `local`/`shared` kinds, ports or active state should read `state.legacyLinks ?? state.links`. A UDP self-edge describes an observed listener with an unknown peer. Named pipe self-edges describe only name-based attribution.
- Computer lane: `state.sampledAt` is null and `state.fresh` is false until the first successful network sample after startup. Keep any previously received sample marked stale while fresh is false. Standalone runs keep `state.phone` null unless Phone polling is explicitly enabled.

- Phone lane: supply `gateway/fga-model.js` for the `npm run fga:model` entry point. The backend lane owns the npm script, and the gateway lane owns its implementation.
- Computer lane: `devices.source` is now present in `/api/state` and SSE state. It is `live` when both detectors are reporting and `registry` while either device is waiting for a detector or using the registry fallback. A healthy detector still takes priority for its device.
- Claude lane: show a small **PHONE** pill in the header. `state.phone` is `null` if the gateway is unavailable. When online it carries `online`, `lookups`, `blocked`, `approvals` (active grants), and `lastTracker` (the latest tracker domain, or null).
- Computer lane: show `apps[].background` with today's observed socket count and distinct attributed company and tracker names. Render `background-talk` events using `app`, `connections` and the `companies` array. This is based on the foreground app sampled when Outbound first observed each socket.
- Computer and Globe lanes: `destinations[].firstSeenEver` marks the destination that introduced a company to the local history. Render `new-company` using `org`, `app`, `country` and `tracker`. On a fresh install, initial observations can introduce several companies at once.
