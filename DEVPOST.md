# Outbound

**See where Windows apps connect and when they use your microphone or camera.**

## Inspiration

CBC Marketplace tested six popular mobile apps in November 2026 and reported that the Tim Hortons app appeared to connect to outside companies as soon as it opened. We wanted to make that kind of discovery possible on a Windows laptop, using the apps that are already running. [CBC Marketplace investigation](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814)

## What it does

Outbound turns a live snapshot of a PC into a laptop dashboard. Click an app to inspect observed endpoints, estimated countries, tracker matches and background connections. Links distinguish observed local sockets from inferred associations. The webcam indicator and mic key respond to Windows capture sessions. Globe plots usable endpoint estimates, illustrates connections with animated packets, and links from company HQ references to sourced incidents.

An opt-in scan shows browser history domains and cookie host counts, app-data metadata, Windows permission history, software inventory, startup entries and tasks, extension permissions, and registry privacy settings. It keeps the last completed scan available while a new one runs. The Dossier supplies context from public sources. Exposure scores show each observed factor and its coverage, and History shows recent daily totals. Rules default to a local dry run that previews firewall commands.

## How we built it

A local Node.js server reads Windows TCP sockets with `netstat -ano` and joins process IDs to executable names and icons. It attributes endpoints using the Windows DNS cache when available, reverse DNS, an offline autonomous system number (ASN) database for network owners and an offline IP geolocation database. Server-Sent Events stream the observations to the dashboard, and globe.gl plots the estimated endpoint locations.

We started with the Windows privacy registry, but its timestamps did not update live on our demo PC. We switched to Windows Core Audio capture sessions for the microphone and Media Foundation camera activity for the webcam. Outbound timestamps changes it observes and uses them to update the day's totals.

Desktop policy supports optional Auth0 sign-in to identify the rule author. The configured policy provider requests consent through CIBA and records approval as an opaque FGA tuple. The separate Phone gateway uses CIBA and FGA for expiring DNS tracker grants. Fixture tests exercise approval and policy checks. Our reported hosted request stopped at Guardian enrollment before push delivery. Hosted end-to-end approval and revocation remain unverified. The labeled Phone offline demo uses real loopback DNS, fixture answers and simulated approval decisions.

Both HTTP dashboards bind to loopback. Scan data stays on the PC. SQLite queries select cookie hosts and counts, and the app-folder walk reads file metadata. The worker keeps the previous result in a local cache and exposes a small status endpoint while measurements continue. ASN and geolocation tables are local. Reverse DNS can depend on the system resolver, and Phone DNS and hosted Auth0 use their configured external services.

## Challenges we ran into

An IP address often identifies a cloud provider or CDN. We use hostnames when available and leave unknown owners and locations visible when attribution is missing. Busy pages can build up hundreds of destinations, so we bound the live view while retaining daily aggregates. A registry record with no stop timestamp can outlast a running app, and tracker matches in the scan describe earlier public measurements of the sites.

## Accomplishments we’re proud of

We combined live socket and device observations, a read-only scan, and a sourced research dossier in one local workflow. A judge can follow a visible connection, inspect its attribution and source, then preview a rule. The dashboard keeps observed activity, inferred relationships, and recorded policies distinct.

## What we learned

Sockets, DNS names and device timestamps answer different questions. Keeping the source and limits of each observation visible helps people interpret a connection without needing to read a network trace.

## What’s next

We want to validate the full hosted consent flow with an enrolled approver, expand the Dossier with verified sources, and make it easier to compare opt-in snapshots over time.
