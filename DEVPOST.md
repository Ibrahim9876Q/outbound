# Outbound

**Discover where your Windows apps connect, what they leave on the PC, and when they use sensitive permissions.**

## Inspiration

CBC Marketplace reported that the Tim Hortons app appeared to contact outside companies as soon as it opened. We wanted a way to explore similar activity on a Windows laptop and see the evidence behind each observation. [CBC Marketplace investigation](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814)

## What it does

- **Computer and Globe.** Inspect TCP endpoints, attributed owners, tracker matches, and estimated server locations. The laptop’s mic and camera indicators reflect Windows capture sessions.
- **Stored data.** An opt-in scan summarizes browser domains and cookie hosts, app-folder metadata, extension permissions, and Windows permission history. Completed scans can be reopened after a restart.
- **Dossier, exposure and history.** Public claims and incidents link to their sources. Exposure scores show each factor and its coverage. History and a local report summarize observed activity.
- **Rules and Phone.** Desktop Rules previews Windows Firewall commands. The separate DNS gateway supports time-limited tracker approvals when configured.

## How we built it

We join Windows TCP snapshots to process IDs and stream the observations to Computer and Globe through Server-Sent Events. The app uses offline ASN and IP geolocation tables to attribute endpoints. The separate scan worker reads browser databases with SQLite and collects file and Windows metadata on demand.

### Auth0

Optional desktop sign-in identifies the rule author. Auth0 CIBA requests consent through Guardian. FGA stores opaque desktop approval relations and expiring Phone tracker grants. Fixtures covered approval handling, grant checks, expiry, and revocation. The Phone offline demo labels its fixture DNS answers and simulated approvals.

The reported hosted attempt stopped at Guardian enrollment, before a push was delivered. Hosted approval and revocation remain unverified end to end. Our live desktop rehearsal exercised the local dry run.

### Privacy

Both HTTP dashboards bind to loopback. The opt-in scan keeps results on the PC, summarizes history as domains, reads cookie hosts and counts, and skips password stores. Firewall rules stay in preview mode by default. Reverse DNS, Phone DNS forwarding, and hosted Auth0 can contact their configured services.

## Built With

- Node.js 24, Server-Sent Events, and globe.gl
- Windows PowerShell, `netstat`, Core Audio, Media Foundation, and the Windows privacy registry
- Node’s SQLite reader, the Public Suffix List, and WhoTracks.me data
- ip-location-db ASN data and geoip-lite
- A Node.js DNS gateway, Auth0 CIBA, Auth0 FGA, and optional desktop OpenID Connect sign-in

## Challenges

An IP address often points to a CDN or cloud provider. We show the attribution we have and leave unknowns visible. The privacy registry lagged during live device tests, so we use Core Audio and Media Foundation for live indicators and the registry for historical context. Independent scan collectors can report their results even when one source is unavailable.

## Accomplishments

In the live rehearsal, we opened a completed permission scan, found a regulator source in the Dossier, generated a dry-run firewall command for an observed app, and opened a country attribution on the Globe. Each view shows where its evidence came from.

## What we learned

Socket observations, registry timestamps, and public tracker research answer different questions. Showing provenance and gaps in coverage lets a viewer distinguish a connection seen on the laptop from a relationship documented by another source.

## What’s next

Verify hosted consent through approval and revocation on a Guardian-enrolled test device, broaden the sourced Dossier, and compare opt-in snapshots over time.

## Try it

On Windows 11 with Node.js 24, clone the repository, then run `npm ci` and `npm start`. Open `http://127.0.0.1:4317/` and follow the judging walkthrough. The local desktop runs without Auth0 credentials. [Repository](https://github.com/Ibrahim9876Q/outbound) · [Judge’s guide](JUDGING.md)
