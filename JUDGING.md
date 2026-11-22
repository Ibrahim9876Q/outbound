# Judging Outbound

Outbound helps you discover where Windows apps connect and what your PC records about their activity.

## Run locally

Use Windows 11 and Node.js 24. Run these commands in PowerShell from the repository.

```powershell
npm ci
npm start
```

Open `http://127.0.0.1:4317/`. The desktop walkthrough runs in local dry-run mode without Auth0 credentials. Before the timer, open **Stored data** → **Scan this PC**, wait for a usable result, and pick a permission row you can share.

## Three-minute walkthrough

| Time | What to click and look for |
| --- | --- |
| 0:00–0:25 | **Computer** → a running app. Read an observed endpoint and its attributed owner, or show an observed local link. |
| 0:25–1:00 | **Stored data** → **Permission history**. Point to a recorded timestamp. Use **Previous scan** and its collection time if a rescan is in progress. |
| 1:00–1:30 | **Dossier** → search **Tim Hortons** → click the result. Under **Documented incidents**, point to the 2022 location investigation and its regulator source. |
| 1:30–2:15 | **Computer** → a rehearsed app with a known executable path → **Block app** → **Preview block**. Show the **DRY RUN** command and the consent steps in **Rules**. |
| 2:15–3:00 | **Show app on globe** → a country row. Choose **All apps** if the selected app has no mapped endpoints. |

After the timer, click **Remove** on the rehearsal rule in **Rules**.

## What the screen represents

- **Live.** Computer uses current Windows socket and device observations. Globe animates observed connections and estimates endpoint locations.
- **Cached.** A completed opt-in scan is a point-in-time record. Its displayed finish time identifies when it was collected.
- **Fixture.** The **FIXTURE DATA** desktop replay is for performance testing. The separate Phone **DEMO DATA** flow uses loopback DNS with fixture answers and simulated approvals.
- **Research.** The Dossier draws from public records and lists their sources.

## Privacy and Auth0

The HTTP dashboards bind to loopback. The opt-in scan keeps results on the PC, summarizes history as domains, reads cookie hosts and counts, and skips password stores. Rules preview changes by default. Reverse DNS, configured Phone DNS forwarding, and hosted Auth0 can contact their respective services.

CIBA requests consent through Guardian. FGA records opaque desktop approval relations or expiring Phone tracker grants. Fixture tests verified approval handling, FGA checks, expiry, and revocation. The local rule preview was rehearsed live. The reported hosted attempt stopped at Guardian enrollment. Hosted approval and revocation remain unverified end to end.

[Full script and fallbacks](DEMO.md) · [Phone walkthrough](gateway/README.md) · [Auth0 setup](research/SETUP-AUTH0.md)
