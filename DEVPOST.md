# Outbound

**See where Windows apps connect and when they use your microphone or camera.**

## Inspiration

CBC Marketplace tested six popular mobile apps in November 2026 and reported that the Tim Hortons app appeared to connect to outside companies as soon as it opened. We wanted to make that kind of discovery possible on a Windows laptop, using the apps that are already running. [CBC Marketplace investigation](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814)

## What it does

Outbound turns a live snapshot of a PC into a laptop dashboard. Click an app to see the endpoints it connects to, their estimated countries and recognizable tracker domains. Links show when two programs have a local TCP connection or both connect to the same attributed company. The webcam indicator and mic key light up when Windows reports an app using those devices. The Globe view plots the estimated location of each destination and lets you filter by app.

The Phone dashboard demonstrates a DNS consent firewall. Auth0 CIBA requests approval through Guardian, and Auth0 FGA stores the per-tracker grant with an expiry. Revoking the grant blocks subsequent tracker lookups through the gateway.

## How we built it

A local Node.js server reads Windows TCP sockets with `netstat -ano` and joins process IDs to executable names and icons. It attributes endpoints using the Windows DNS cache when available, reverse DNS, an offline autonomous system number (ASN) database for network owners and an offline IP geolocation database. Server-Sent Events stream the observations to the dashboard, and globe.gl plots the estimated endpoint locations.

We started with the Windows privacy registry, but its timestamps did not update live on our demo PC. We switched to Windows Core Audio capture sessions for the microphone and Media Foundation camera activity for the webcam. Outbound timestamps changes it observes and uses them to update the day's totals.

The phone DNS gateway checks tracker lookups against active permissions before forwarding them. Auth0 Client-Initiated Backchannel Authentication (CIBA) sends an approval prompt to the enrolled user in Guardian. Auth0 Fine-Grained Authorization (FGA) stores the timed grant and checks it on later lookups. The gateway removes the grant when the user revokes access.

The server binds to the PC’s loopback address so other devices on the network cannot open the dashboard. We keep connection observations in memory and save device session history locally. Owner and geography lookups use local tables, and hostname fallback uses the Windows resolver.

## Challenges we ran into

An IP address often identifies a cloud provider or CDN. We use hostnames when available and leave unknown owners and locations visible when attribution is missing. Busy pages exposed a second problem. Hundreds of destinations could build up in the live view, so we retain the newest inactive destinations per app while rolling today's observations into a local summary.

## Accomplishments we’re proud of

We brought three kinds of evidence into one view. An ordinary app can light up a connection to a place a user may never have thought about, the laptop shows when a device starts being used, and each app has details users can inspect. The dashboard’s runtime assets and lookups work from the laptop itself.

On our laptop, a single load of weather.com produced connections attributed to **38 companies in 13 countries**, with **seven tracker companies** flagged during that run. After expanding our organization list, a separate single-load test flagged **13 trackers with categories**. The counts reflect observed TCP connections and the IP and hostname attribution available during each run.

## What we learned

Sockets, DNS names and device timestamps answer different questions. Keeping the source and limits of each observation visible helps people interpret a connection without needing to read a network trace.

## What’s next

We want to make it easier to connect a phone to the DNS gateway and give people more control over how long they approve each tracker.
