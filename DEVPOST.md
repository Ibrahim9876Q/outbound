# Outbound

**Discover where your Windows apps connect, what they leave on the PC, and when they use sensitive permissions.**

## Inspiration

CBC Marketplace reported that the Tim Hortons app appeared to contact outside companies as soon as it opened. We wanted a way to explore similar activity on a Windows laptop and see the evidence behind each observation. [CBC Marketplace investigation](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814)

## What it does

- **Computer and Globe.** Select an app to inspect observed TCP destinations, attributed owners, tracker matches and estimated endpoint locations. Globe animates those connections. The laptop’s mic key and camera lamp reflect Windows capture sessions. Links distinguish observed local sockets and process relationships from inferred associations.
- **Stored data and Permission history.** The opt-in scan summarizes browser history domains and cookie hosts, app-folder metadata, installed software, startup entries and tasks, extension permissions, and Windows privacy settings and permission timestamps. The previous completed scan stays available during a rescan and can be reopened after a restart.
- **Dossier, exposure and history.** The Dossier links public claims and incidents to sources. Exposure scores show the factors and coverage behind the number. Daily history and a local Markdown report summarize the observations over time.
- **Rules and Phone.** Desktop Rules previews Windows Firewall commands in dry-run mode. A separate DNS gateway can require time-limited approval for tracker lookups when configured. The offline Phone demo labels its fixture DNS answers and simulated approvals.

## How we use Auth0

Optional desktop sign-in identifies the local rule author. For a configured approval, Auth0 CIBA requests a decision through Guardian. On approval, Auth0 FGA stores an opaque rule relation. The Phone gateway uses CIBA and FGA for expiring DNS tracker grants. Fixture tests exercise request and approval handling, FGA checks, expiry, and revocation.

The reported hosted attempt stopped at Guardian enrollment, before a push was delivered. Hosted approval and revocation remain unverified end to end. Our live desktop rehearsal exercised the local dry run.

## Privacy

Both HTTP dashboards bind to loopback. The opt-in scan keeps its results and caches on the PC. Browser history in the result is reduced to domains. Cookie queries select host and count fields. The scanner leaves password stores alone, and the app-folder walk reads names, sizes and timestamps. The desktop uses offline ASN and IP geolocation data. Reverse DNS can use the operating system’s resolver. Optional Phone DNS forwarding and hosted Auth0 use the configured upstream services. Firewall rules stay in preview mode by default.

## Built with

- Node.js 24, Server-Sent Events, and globe.gl
- Windows PowerShell, `netstat`, Core Audio, Media Foundation, and the Windows privacy registry
- Node’s SQLite reader, the Public Suffix List, and WhoTracks.me data
- ip-location-db ASN data and geoip-lite
- A Node.js DNS gateway, Auth0 CIBA, Auth0 FGA, and optional desktop OpenID Connect sign-in

## Challenges and accomplishments

An IP address often points to a CDN or cloud provider. We show the attribution we have and leave unknowns visible. The privacy registry lagged during live device tests, so we use Core Audio and Media Foundation for live indicators and the registry for historical context. We also kept local browsing metadata readable while independent collectors fail or finish at different times.

The live demo shows a Windows permission record and a separate public investigation with its source. It then follows an observed app through a firewall preview to the Globe. Each view shows the basis for its claims so a judge can inspect the underlying evidence.

## What’s next

Verify hosted consent through approval and revocation on a Guardian-enrolled test device, broaden the sourced Dossier, and compare opt-in snapshots over time.
