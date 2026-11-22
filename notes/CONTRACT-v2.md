# Outbound v2 shared contract (round "xray2")

Every lane builds against this file. If you need to change a shape, add a field (never rename or remove) and note it in your lane's REQUESTS file.

## File ownership this round
| Lane | Branch | Owns |
| --- | --- | --- |
| Codex 1 front end | globe | `public/**` except `public/data/research.json`; `index.html`, all CSS |
| Codex 2 back end | backend | `server.js`, `lib/*.js`, `lib/scan/**`, `lib/links.js`, `scripts/*.ps1`, `public/data/site-trackers.json`, `package.json`, `DEMO.md`, `DEVPOST.md` |
| Codex 3 research + blocking | phone | `public/data/research.json`, `research/**`, `lib/blocker/**`, `gateway/**` |

Codex 3 may add exactly one line to `server.js`: `if (await require('./lib/blocker/routes').handle(req, res, url)) return;` placed before the static-file fallback. Nothing else outside its folders.

## 1. Stored-data scan (Codex 2)
Opt-in only: nothing is read until the user presses **Scan this PC**. Local only. Results are kept in memory and in `/api/report`; never sent anywhere.

`POST /api/scan` starts a scan and returns `{ ok, startedAt }` (409 if one is running).
`GET /api/scan` returns:
```
{ status: "idle"|"running"|"done"|"error", startedAt, finishedAt, progress: 0..1, error?,
  browsers: [{ browser: "Chrome"|"Edge"|"Firefox"|"Brave"|"Opera", profile, historyAvailable, cookiesAvailable, blockedReason?,
               sites: [{ domain, visits, lastVisit, company?, trackers: [{ company, domain, category }] }],
               cookieDomains: [{ domain, cookies, company?, isTracker, category? }] }],
  apps: [{ app, path, bytes, files, kinds: { cache, cookies, logs, databases, other }, lastWrite }],
  summary: { sitesVisited, sitesWithTrackers, trackerCompanies, cookieDomains, trackerCookieDomains, appDataBytes, topTrackers: [{ company, sites }] } }
```
Rules: domains only (strip path, query, fragment). Never read cookie values, `Login Data`, `Web Data`, autofill, passwords, tokens, or message content. If a DB is locked, report `blockedReason` honestly (for example "close Edge to read its cookie list"); do not ask for admin.

`sites[].trackers` comes from a public per-site tracker dataset vendored into `public/data/site-trackers.json` with its source and license recorded inside the file.

## 2. Inter-app links (Codex 2)
`/api/state` gains `links: [{ id, from, to, kind, evidence, confidence: "observed"|"inferred", since }]`.
`from`/`to` are app names as used in `apps[]`, or `"company:<Name>"` for shared-company hubs.
`kind` is one of `loopback` (TCP between two local processes), `parent` (process tree), `pipe` (named pipe, name-based attribution = inferred), `udp` (local UDP listener), `shared-company` (two apps contacting the same company), `shared-tracker` (same, company is a tracker).
`/api/state.apps[]` gains `udp: [{ localPort, localAddress }]` and `children: [appName]`.

## 3. Research dossier (Codex 3) — `public/data/research.json`
```
{ version: 2, generatedAt, method, apps: [{
    id, name, publisher, category, processNames: ["discord.exe"], domains: ["discord.com"],
    hq: { city, country },
    declared: [{ data, purpose, source }],          // what the company itself says it collects (privacy policy)
    sharesWith: [{ party, purpose, source }],
    destinations: [{ country, note, source }],        // where the company says data is stored or transferred
    incidents: [{ kind: "court"|"settlement"|"fine"|"regulator"|"investigation"|"report"|"breach",
                  title, year, jurisdiction, amount?, summary, source }] }],
  companies: [{ name, aliases, hq: { city, country }, incidents: [...same shape], declared: [...] }] }
source = { title, publisher, url, date, verified: true|false, fetchedAt? }
```
Never invent a case, fine, amount, date or URL. `verified: true` only when the URL was fetched this round and the page supports the claim. Unverified items stay out of the file.

## 4. Blocking architecture (Codex 3) — no Auth0 account needed
`lib/blocker/` with:
- `policy.js`: rules `{ id, target: { kind: "app"|"company"|"domain"|"ip", value }, action: "block"|"allow"|"ask", scope: "always"|"session", createdBy, createdAt, approval }`, stored in `data/policy.json`.
- `providers/local.js` (default, approves locally) and `providers/auth0.js` (CIBA ask + FGA write/check, reads env vars, returns `{ configured:false }` when unset; never throws on missing config).
- `enforcers/dry-run.js` (default; returns the exact commands it would run) and `enforcers/windows-firewall.js` (generates `netsh advfirewall firewall add rule ...` / `New-NetFirewallRule` commands; only executes when `OUTBOUND_ENFORCE=firewall` is set AND the process is elevated; otherwise returns the plan).
Routes (via `lib/blocker/routes.js`):
`GET /api/policy` → `{ provider, providerConfigured, enforcer, rules, plan }`
`POST /api/policy/rules` body `{ target, action, scope }` → `{ rule, decision: { status: "approved"|"pending"|"denied", via }, plan: [{ command, applied: false, reason }] }`
`DELETE /api/policy/rules/<id>` → `{ ok, plan }`
`POST /api/policy/check` body `{ app?, company?, domain?, ip? }` → `{ action, ruleId?, via }`

## 5. Front end (Codex 1)
Renders all of the above, with an honest empty state when an endpoint returns 404 or empty ("backend not merged yet" is fine during development). Never show placeholder numbers.

## 6. Extended opt-in scan (xray3)

`POST /api/scan` keeps its existing shape. It returns 409 while the foreground scan or its app-data continuation is active. `GET /api/scan` adds:

```
permissions: [{ capability, app, exe: string|null, allowed: string|null,
                lastUsedStart: number|null, lastUsedStop: number|null, inUse: boolean }]
installed: [{ name, publisher: string|null, version: string|null,
              installDate: "YYYY-MM-DD"|null, sizeBytes: number|null,
              source: "HKLM"|"HKLM-WOW6432Node"|"HKCU"|"Appx", researchId? }]
autoruns: [{ kind: "startup"|"task"|"service", name, command, publisher?,
             flagged: boolean, reason: string|null, status?, startType?,
             triggers?: [{ type, enabled, start, end, repetition, daysInterval,
                            daysOfWeek, weeksInterval, delay }] }]
extensions: [{ browser, profile, id, name, version: string|null,
               permissions: string[], allSites: boolean, risky: boolean }]
windowsPrivacy: [{ setting, value: number|string|null, meaning, recommended }]
warnings: string[]
appDataBackground: boolean
appDataCachedAt: number|null
apps[].partial: boolean
```

Timestamps are Unix milliseconds. A missing registry value or absent inventory field remains null. `permissions[].inUse` reflects a recorded start with zero stop FILETIME. It may outlast the process. Autorun and extension flags are based on metadata. `status: "done"` with `appDataBackground: true` means the 20-second provisional app-data snapshot has been published. Poll until it is false for the completed walk and cache timestamp. A row with `partial: true` has provisional totals. The scan and cache stay local.

## 7. Exposure scores, history and payload metadata (xray4)

`GET /api/score` returns `{ sampledAt: number|null, overall: Score, apps: [{ id, name, score: Score }] }`. `/api/state` and SSE add `apps[].score: Score|null`.

```
Score = { value: number|null, coverage: number,
          factors: [{ factor, weight, raw: number|null, points: number|null, reason }] }
GET /api/history = { days: [{ date: "YYYY-MM-DD", apps: [
  { id, name, companies, trackers, countries, backgroundMinutes, micSeconds, cameraSeconds }
] }] }
```

History contains at most 30 local calendar days. Background minutes estimate intervals between consecutive observed background samples. Mic and camera seconds combine overlapping sessions. A null score input means the relevant observation is missing. Coverage is the available weight, out of 100. See `SCORE.md`.

The following records may carry an optional `researchId`: `apps[]`, `scan.installed[]`, `scan.extensions[]`, `scan.permissions[]`, `scan.browsers[].sites[]`, and `scan.browsers[].cookieDomains[]`. Extension rows may also have `publisher`. Dossier IDs are app IDs or `company:<canonical company name>`. Missing or ambiguous matches are omitted.

State and SSE include pre-cap retained counts in `totals: { apps, links, legacyLinks, events }`, `apps[].totals: { destinations, localPeers, udp, children, backgroundCompanies, backgroundTrackers }`, and `devices.{mic,camera}.totals: { recentSessions, lastUsedByApp }`. The visible limits are 80 apps, 160 of each link array, 24 events, 40 destinations per app, 20 UDP listeners, 24 peer/child/background names per list, and 10 device sessions or last-used rows per list. Scores and history are computed before these display caps.

## 8. Retained scans and lightweight polling (xray5)

When an existing scan cache is unreadable, `/api/scan` includes a warning and `/api/scan/status` counts it. A subsequent completed scan can replace it. Device usage and daily history expose optional `devices.warning` in `/api/state` and `warning` in `/api/history` when records could not be restored. An invalid policy file returns HTTP 503 with an error message and stays on disk untouched.

`GET /api/scan` keeps its existing fields. It adds `cached: boolean` and can embed the last completed snapshot as `previous` while a newer scan is running, provisional, or failed. A restored snapshot or reused `previous` has `cached: true` with the original `finishedAt`. Fresh results have `cached: false`. Only a scan that completes its background walk replaces the saved snapshot. The full route supports gzip and sends `Cache-Control: no-store`.

```
GET /api/scan/status = {
  status, startedAt, finishedAt, progress, cached, appDataBackground, appDataCachedAt,
  counts: { browsers, apps, permissions, installed, autoruns, extensions, windowsPrivacy },
  warningCount, previous: { finishedAt, cached: true } | null, error?
}
```

Poll status for progress and fetch the full result when a visible section is ready or the scan completes. Counts describe rows available in the current result and can include stale autorun rows. `autoruns[].stale: true` marks rows retained from the last completed scan while their source is being retried or could not be refreshed. Each successful source replaces its own rows, including when it returns an empty list.

## 9. Performance replay (xray9)

`npm run fixture` requires `OUTBOUND_FIXTURE` to point to a local recording of a fresh `/api/state` response with 80 distinct apps. Replay is for performance testing only. No live collector or Phone bridge runs in this mode. Every response has `X-Outbound-Mode: FIXTURE DATA`. The dashboard header, `/api/state` JSON, and each SSE state frame carry the same label. The recording retains its original timestamps. Other API and auth reads return a labeled HTTP 503, and API writes return a labeled HTTP 405.
