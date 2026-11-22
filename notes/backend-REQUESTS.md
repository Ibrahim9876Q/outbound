# Backend requests

- Phone lane: supply `gateway/fga-model.js` for the `npm run fga:model` entry point. The backend lane owns the npm script, and the gateway lane owns its implementation.
- Computer lane: `devices.source` is now present in `/api/state` and SSE state. It is `live` when both detectors are reporting and `registry` while either device is waiting for a detector or using the registry fallback. A healthy detector still takes priority for its device.
- Claude lane: show a small **PHONE** pill in the header. `state.phone` is `null` if the gateway is unavailable. When online it carries `online`, `lookups`, `blocked`, `approvals` (active grants), and `lastTracker` (the latest tracker domain, or null).
- Computer lane: show `apps[].background` with today's observed socket count and distinct attributed company and tracker names. Render `background-talk` events using `app`, `connections` and the `companies` array. This is based on the foreground app sampled when Outbound first observed each socket.
- Computer and Globe lanes: `destinations[].firstSeenEver` marks the destination that introduced a company to the local history. Render `new-company` using `org`, `app`, `country` and `tracker`. On a fresh install, initial observations can introduce several companies at once.
