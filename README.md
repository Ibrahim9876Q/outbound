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

Open [Desktop](http://127.0.0.1:4317/) and [Phone](http://127.0.0.1:4320/). If PowerShell blocks the npm shim, use `npm.cmd`. Use `npm start` for the desktop alone. `PORT` changes the desktop HTTP port. For a fresh clone with the checked-in lockfile, `npm ci` can install the dependencies.

- **Phone setup.** Copy [`.env.example`](.env.example) to the gitignored `.env` when configuring the gateway. Phone defaults to loopback HTTP port `4320` and loopback UDP/TCP DNS port `5354`. The gateway loads `.env`. `npm run dev:all` enables desktop Phone polling and points it at the gateway. A standalone desktop polls only with `OUTBOUND_PHONE=1` or a loopback HTTP `PHONE_URL`. To run a second copy from a separate checkout, set `PORT`, `PHONE_DASHBOARD_PORT`, and `PHONE_DNS_PORT` to free ports in the shell before launch and open Phone at the chosen address. [Phone setup and offline demo](gateway/README.md)
- **Desktop Auth0.** Dashboard sign-in is optional with `AUTH0_LOGIN=1`. Desktop CIBA/FGA policy uses `OUTBOUND_FGA_MODEL_ID`, while Phone consent uses `FGA_MODEL_ID`. To load desktop settings from `.env`, launch with `node --env-file=.env server.js`. See the setup guide for callback URLs, Guardian enrollment, and the other required environment variables. [Desktop Auth0 setup](research/SETUP-AUTH0.md)
- **Troubleshooting.** If a port is busy, close the old Outbound process from its terminal. Use `npm run check` to verify desktop assets and routes on an ephemeral loopback port. The Windows DNS cache may require an elevated launch to expose more hostnames.

## Quick demo

1. In **Computer**, select a running app and point to an observed endpoint and its attribution. Use an observed local link if remote traffic is sparse.
2. In **Stored data**, run **Scan this PC** before the timer. When the scan is ready, open **Permission history** and show one recorded timestamp.
3. In **Dossier**, search **Tim Hortons** and click its result. Under **Documented incidents**, point to the mobile location investigation and its regulator source.
4. Return to **Computer** and choose **Block app** for a rehearsed app with a known executable path, then **Preview block**. Point to **DRY RUN**.
5. Click **Show app on globe**, then open a country row. Use **All apps** if the selected app has no mapped endpoints. [Judge’s guide](JUDGING.md) · [Three-minute script](DEMO.md)

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
The dossier contains **338 apps**, **197 companies**, and **240 incident records**, with **587 distinct source URLs** across its records.
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
| `GET /api/scan` · `POST /api/scan` | Read the current and retained scan results or start a new opt-in scan. Starting while a scan or its background folder walk is active returns 409. |
| `GET /api/scan/status` | Lightweight progress, section counts, and cached-result metadata. |
| `GET /api/score` | Overall and per-app exposure factors, reasons and coverage. |
| `GET /api/history` | Up to 30 local days of per-app aggregates. |
| `GET /api/report` · `GET /api/report/download` | Local Markdown report and attachment. |
| `GET /api/policy` | Read rules, command previews, and the configured provider and enforcer. |
| `POST /api/policy/rules` · `POST /api/policy/check` | Create a rule or check the decision for a target. |
| `GET /api/policy/requests/:id` · `DELETE /api/policy/rules/:id` | Poll an approval request or remove a rule. |
| `GET /auth/me` · `GET /auth/login` · `GET /auth/callback` · `GET /auth/logout` | Read desktop identity status and handle the optional Auth0 sign-in flow. |

The response contracts are documented in [notes/CONTRACT-v2.md](notes/CONTRACT-v2.md).

In local mode, `/auth/me` reports sign-in as disabled. The login, callback, and logout routes return 404 until sign-in is enabled. Approval polling requires a pending or retained Auth0 request ID.

## Data sources and licenses

- **Site tracker associations.** WhoTracks.Me measurements are CC BY 4.0. Ghostery TrackerDB metadata is CC BY-NC-SA 4.0. The combined subset in `public/data/site-trackers.json` retains these source notices and TrackerDB's non-commercial and share-alike terms. [WhoTracks.Me](https://github.com/whotracksme/whotracks.me) · [TrackerDB license](https://github.com/ghostery/trackerdb/blob/main/LICENSE)
- **ASN attribution.** The pinned `@ip-location-db/asn` package credits RouteViews, DB-IP and NRO under CC BY 4.0. Its publisher flags accuracy issues with the npm dataset. DB-IP asks for a link on pages that use its data. [ip-location-db](https://github.com/sapics/ip-location-db) · [RouteViews](https://www.routeviews.org/) · [DB-IP](https://db-ip.com/) · [NRO](https://www.nro.net/)
- **IP geolocation.** The installed `geoip-lite` package labels the library Apache-2.0 and the included GeoLite2 data CC BY-SA 4.0 in its license notice. This product includes GeoLite2 data created by MaxMind. Updated downloads carry their own terms. [geoip-lite](https://github.com/geoip-lite/node-geoip) · [MaxMind](https://www.maxmind.com/) · [GeoLite terms](https://www.maxmind.com/en/geolite/eula)
- **Domain grouping and map.** The vendored Public Suffix List is MPL-2.0. The Natural Earth polygons are public domain. [Public Suffix List](https://publicsuffix.org/list/) · [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)
- **Dossier.** Claims link to their original regulator, court, company, or press sources. Consult each publisher's terms for reuse. [Research method](research/METHOD.md)

The repository has source-specific data terms and no blanket license grant for the combined checkout.

## Verify

Run `npm test` for fixtures and `npm run check` for the desktop smoke test. GitHub Actions runs the fixture suite on Windows with Node 24. The live walkthrough and submission draft are in [DEMO.md](DEMO.md) and [DEVPOST.md](DEVPOST.md).

### Performance replay

Use replay for local performance testing only. Use the live dashboard for demos. Record a fresh `/api/state` response from your own live desktop once the `apps` array contains 80 distinct apps. This example uses the default desktop port. Keep the recording in gitignored `data/` on this PC because it can contain local app and connection metadata.

```powershell
New-Item -ItemType Directory -Force data | Out-Null
curl.exe --fail --silent --show-error --output data/benchmark-state.json http://127.0.0.1:4317/api/state
```

Open a new shell and use a free loopback port for the replay.

```powershell
$env:PORT = '4319'
$env:OUTBOUND_FIXTURE = 'data/benchmark-state.json'
npm run fixture
```

Open `http://127.0.0.1:4319/`. The launcher requires the recording path. The dashboard header, `/api/state`, and SSE state show **FIXTURE DATA**. Every replay response includes `X-Outbound-Mode: FIXTURE DATA`. The server replays the original state without collecting new data or creating rules. Other API reads report that no recording is available and writes are disabled. After stopping the replay, clear the flag with `Remove-Item Env:OUTBOUND_FIXTURE` or close that shell before starting the live dashboard.

## Team

TODO
