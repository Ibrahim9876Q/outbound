```text
  ___  _   _ _____ ____   ___  _   _ _   _ ____
 / _ \| | | |_   _| __ ) / _ \| | | | \ | |  _ \
| | | | | | | | | |  _ \| | | | | |  \| | | | |
| |_| | |_| | | | |_) | |_| | |_| | |\  | |_| |
 \___/ \___/  |_| |____/ \___/ \___/|_| \_|____/
```

Outbound is a local Windows dashboard that makes app connections and device use visible. Inspect live TCP endpoints, see when an app uses the microphone or camera, and opt in to a scan of stored browser and Windows metadata. The sourced dossier connects these observations to public privacy policies and documented incidents. Built at Hack Western 13 for **Discover the Unknown**.

## Run

Use Windows 11 and Node.js 24. Run these commands from a repository checkout.

```powershell
npm install
npm run dev:all
```

Open [Desktop](http://127.0.0.1:4317/) and [Phone](http://127.0.0.1:4320/). If PowerShell blocks the npm shim, use `npm.cmd`. Use `npm start` for the desktop alone. `PORT` changes the desktop HTTP port.

- **Phone setup.** Copy [`.env.example`](.env.example) to the gitignored `.env` when configuring the gateway. Keep the loopback defaults for laptop-only DNS. The gateway loads `.env`. The desktop launcher opts into Phone polling with `OUTBOUND_PHONE=1`. A standalone desktop polls only when started with this flag or a loopback `PHONE_URL`. To run a second copy from a separate checkout, set `PORT`, `PHONE_DASHBOARD_PORT`, and `PHONE_DNS_PORT` to free ports in the shell before `npm run dev:all`. [Phone setup and offline demo](gateway/README.md)
- **Desktop Auth0.** Dashboard sign-in is optional with `AUTH0_LOGIN=1`. Desktop CIBA/FGA policy uses `OUTBOUND_FGA_MODEL_ID`, while Phone consent uses `FGA_MODEL_ID`. To load desktop settings from `.env`, launch with `node --env-file=.env server.js`. See the setup guide for callback URLs, Guardian enrollment, and the other required environment variables. [Desktop Auth0 setup](research/SETUP-AUTH0.md)
- **Troubleshooting.** If a port is busy, close the old Outbound process from its terminal. Use `npm run check` to verify desktop assets and routes on an ephemeral loopback port. The Windows DNS cache may require an elevated launch to expose more hostnames.

## Views

| View | Key | What it shows |
| --- | --- | --- |
| Computer | 1 | Observed apps and endpoints, background connections, MIC and CAM activity, app exposure factors, and a live feed. Links distinguish observed local sockets from inferred relationships. |
| Globe | 2 | Usable endpoint location estimates with illustrative arcs, company HQ reference points, and links to sourced incidents. |
| Phone | | The DNS gateway and tracker consent demo. Hosted consent uses Auth0 CIBA with Guardian and timed FGA grants. |
| Stored data | 3 | The opt-in scan covers browser history domains, cookie hosts and counts, recorded Windows permission history, installed software, startup entries and tasks, extension permissions, privacy settings, and app-folder metadata. |
| Dossier | 4 | Sourced company claims, documented incidents, and links to original records. |
| Rules | 5 | Local or configured Auth0 policy decisions and Windows Firewall command previews. Dry run is the default. |
| History | 6 | The last seven recorded days in the UI, with up to 30 local days available through the API. |

<!-- dossier-counts:start -->
The dossier contains **334 apps**, **199 companies**, and **244 incident records**, with **575 distinct source URLs** across its records.
<!-- dossier-counts:end -->

Counts include incident records from app and company entries. Run `npm run docs:counts` after rebuilding [the dossier](public/data/research.json).

**Screenshot placeholders.** Add a redacted Computer view with a controlled loopback connection and a redacted Globe view showing an endpoint estimate.

## Privacy and limitations

- Desktop and Phone HTTP dashboards bind to `127.0.0.1`. The opt-in phone DNS listener can bind to a configured private adapter. Scan results, device sessions and recent history stay on the PC.
- The stored-data scan starts when requested. History is reduced to domains. SQLite cookie queries select hosts and counts. The scanner skips password, autofill and token stores and deletes its temporary database copies after reading.
- Offline ASN and geolocation data supply estimates. Windows reverse DNS can contact the configured resolver. Phone forwards DNS to its configured upstream, and optional hosted sign-in and approval contact Auth0. The desktop policy flow uses an approval reference and opaque FGA rule IDs.
- Rules preview changes by default. Firewall enforcement requires `OUTBOUND_ENFORCE=firewall`, elevation and a target the enforcer can resolve. The labeled Phone offline demo uses real loopback DNS with fixture answers and simulated approval decisions. Hosted approval through revocation remains unverified.
- Sampling can miss brief sockets and device sessions. TCP snapshots omit QUIC traffic. Endpoints can be attributed to a network or CDN provider, and shared owners and pipes can be inferred. The app measures connection metadata without inspecting packet payloads or recording device media.
- Browser tracker matches come from prior public measurements. Extension and autorun flags describe metadata. Registry access timestamps can outlast a running process, and a locked browser database can limit coverage.
- Exposure scores summarize observed factors and show coverage. Folder totals can be provisional, and cached scan results carry their collection time.

## Architecture

```text
 Windows collectors (read-only)
   netstat, process graph, foreground app, mic and camera
       |
       v
 Node desktop (127.0.0.1:4317) --> SSE /events --> Computer and Globe
   |       |                                    endpoint estimates
   |       +--> /api/score, /api/history, /api/report
   +--> opt-in scan worker --> local scan cache --> Stored data
   +--> local research dataset -----------------> Dossier
   +--> /api/policy --> local provider or Auth0 CIBA + FGA
                     --> dry-run or opted-in elevated enforcer

 Phone dashboard (127.0.0.1:4320) --> DNS gateway --> configured resolver
     tracker permission check --> CIBA Guardian approval + FGA timed grant
```

## Local API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/state` | Current desktop snapshot, freshness, visible apps, links, and device state. |
| `GET /events` | SSE stream with the initial state, later updates, and heartbeat comments. |
| `GET /api/scan` · `POST /api/scan` | Read the current and retained scan results or start a new opt-in scan. A concurrent scan returns 409. |
| `GET /api/scan/status` | Lightweight progress, section counts, and cached-result metadata. |
| `GET /api/score` | Overall and per-app exposure factors, reasons and coverage. |
| `GET /api/history` | Up to 30 local days of per-app aggregates. |
| `GET /api/report` | Local Markdown report. Use `/api/report/download` for an attachment. |
| `GET /api/policy` · `/api/policy/*` | Read policy state, submit or check rules, poll pending approvals, or remove rules. |
| `GET /auth/*` | Optional desktop Auth0 endpoints `login`, `callback`, `logout`, and `me`. |

The response contracts are documented in [notes/CONTRACT-v2.md](notes/CONTRACT-v2.md).

## Data sources and licenses

- **Site tracker associations.** WhoTracks.Me measurements are CC BY 4.0. Ghostery TrackerDB metadata is CC BY-NC-SA 4.0. The combined subset in `public/data/site-trackers.json` retains these source notices and TrackerDB's non-commercial and share-alike terms. [WhoTracks.Me](https://github.com/whotracksme/whotracks.me) · [TrackerDB license](https://github.com/ghostery/trackerdb/blob/main/LICENSE)
- **ASN attribution.** The pinned `@ip-location-db/asn` package credits RouteViews, DB-IP and NRO under CC BY 4.0. Its publisher flags accuracy issues with the npm dataset. DB-IP asks for a link on pages that use its data. [ip-location-db](https://github.com/sapics/ip-location-db) · [RouteViews](https://www.routeviews.org/) · [DB-IP](https://db-ip.com/) · [NRO](https://www.nro.net/)
- **IP geolocation.** The installed `geoip-lite` package labels the library Apache-2.0 and the included GeoLite2 data CC BY-SA 4.0 in its license notice. This product includes GeoLite2 data created by MaxMind. Updated downloads carry their own terms. [geoip-lite](https://github.com/geoip-lite/node-geoip) · [MaxMind](https://www.maxmind.com/) · [GeoLite terms](https://www.maxmind.com/en/geolite/eula)
- **Domain grouping and map.** The vendored Public Suffix List is MPL-2.0. The Natural Earth polygons are public domain. [Public Suffix List](https://publicsuffix.org/list/) · [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)
- **Dossier.** Claims link to their original regulator, court, company, or press sources. Consult each publisher's terms for reuse. [Research method](research/METHOD.md)

The repository has source-specific data terms and no blanket license grant for the combined checkout.

## Verify

Run `npm test` for fixtures and `npm run check` for the desktop smoke test. GitHub Actions runs the fixture suite on Windows with Node 24. The live walkthrough and submission draft are in [DEMO.md](DEMO.md) and [DEVPOST.md](DEVPOST.md).

## Team

TODO
