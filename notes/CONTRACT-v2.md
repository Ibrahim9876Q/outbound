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
