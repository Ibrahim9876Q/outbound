# Outbound

**See where Windows apps connect and when they use your microphone or camera.**

## Inspiration

CBC Marketplace tested six popular mobile apps in November 2026 and reported that the Tim Hortons app appeared to connect to outside companies as soon as it opened. We wanted to make that kind of discovery possible on a Windows laptop, using the apps that are already running. [CBC Marketplace investigation](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814)

## What it does

Outbound turns a live snapshot of a PC into a laptop dashboard. Click an app to inspect observed endpoints, estimated countries and tracker matches. Links distinguish observed local sockets from inferred associations. The webcam indicator and mic key respond to Windows capture sessions. Globe plots endpoints with usable IP location estimates and animates illustrative packets. An attributed owner can be a cloud or CDN operator.

An opt-in scan shows browser history domains and cookie host counts, app-data metadata, Windows permission history, installed software, startup entries and tasks, extension permissions, and registry privacy settings. A source-backed Dossier supplies context. Local block rules default to a dry run that previews the commands.

## How we built it

A local Node.js server reads Windows TCP sockets with `netstat -ano` and joins process IDs to executable names and icons. It attributes endpoints using the Windows DNS cache when available, reverse DNS, an offline autonomous system number (ASN) database for network owners and an offline IP geolocation database. Server-Sent Events stream the observations to the dashboard, and globe.gl plots the estimated endpoint locations.

We started with the Windows privacy registry, but its timestamps did not update live on our demo PC. We switched to Windows Core Audio capture sessions for the microphone and Media Foundation camera activity for the webcam. Outbound timestamps changes it observes and uses them to update the day's totals.

The Phone gateway implements the CIBA prompt and FGA timed-grant flow. Fixture tests exercise approval, expiry and revocation. Our reported hosted request stopped at Guardian enrollment before push delivery, and hosted approval through revocation remains unverified. The labeled offline demo uses real loopback DNS and simulated approval decisions. The desktop's local dry run previews policy commands.

The desktop server binds to loopback. Scan data stays on the PC. SQLite queries select cookie hosts and counts, and the app-folder walk reads file metadata. ASN and geolocation tables are local. Reverse DNS can depend on the system resolver and network access.

## Challenges we ran into

An IP address often identifies a cloud provider or CDN. We use hostnames when available and leave unknown owners and locations visible when attribution is missing. Busy pages exposed a second problem. Hundreds of destinations could build up in the live view, so we retain the newest inactive destinations per app while rolling today's observations into a local summary.

## Accomplishments we’re proud of

On this PC on **November 22, 2026**, one opt-in scan found **497 visited domains** and matched **104** of them to prior public tracker observations. It returned **629 permission entries across 23 capabilities**, **199 installed-software records**, and **69 browser extensions**, with **35** matching our sensitive-permission rules. Those flags describe declared or recorded access. They cannot establish misuse.

## What we learned

Sockets, DNS names and device timestamps answer different questions. Keeping the source and limits of each observation visible helps people interpret a connection without needing to read a network trace.

## What’s next

We want to validate the full hosted consent flow with an enrolled approver, expand the Dossier with verified sources, and make it easier to compare opt-in snapshots over time.
