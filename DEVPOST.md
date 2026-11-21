# Outbound

**See where Windows apps connect and when they use your microphone or camera.**

## Inspiration

CBC Marketplace tested six popular mobile apps in November 2026 and reported that the Tim Hortons app appeared to connect to outside companies as soon as it opened. We wanted to make that kind of discovery possible on a Windows laptop, using the apps that are already running. [CBC Marketplace investigation](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814)

## What it does

Outbound turns a live snapshot of a PC into a laptop dashboard. Click an app to see the endpoints it connects to, their estimated countries and recognizable tracker domains. Links show when two programs have a local TCP connection or both connect to the same attributed company. The webcam indicator and mic key light up when Windows reports an app using those devices. The Globe view plots the estimated location of each destination and lets you filter by app.

## How we built it

A local Node.js server reads Windows TCP sockets and joins process IDs to executable names and icons. It attributes endpoints using the Windows DNS cache when available, reverse DNS, an offline autonomous system number (ASN) database for network owners and an offline IP geolocation database. It streams state and activity to the dashboard using Server-Sent Events.

Windows already keeps per-app device-use timestamps in the privacy registry. We read the microphone and webcam entries without changing the registry. A start time with a zero stop time indicates active use. After Windows records a stop time, Outbound can show the completed session and update the day’s totals.

The server binds to the PC’s loopback address so other devices on the network cannot open the dashboard. We keep connection observations in memory and save device session history locally. Owner and geography lookups use local tables, and hostname fallback uses the Windows resolver.

## Challenges we ran into

An IP address often identifies a cloud provider or CDN. We use hostnames when available and leave unknown owners and locations visible when attribution is missing. We also had to pair both endpoint records for localhost connections, handle overlapping device sessions and keep slower lookups from holding up the connection scan.

## Accomplishments we’re proud of

We brought three kinds of evidence into one view. An ordinary app can light up a connection to a place a user may never have thought about, the laptop shows when a device starts being used, and each app has details users can inspect. The dashboard’s runtime assets and lookups work from the laptop itself.

## What we learned

Sockets, DNS names and device timestamps answer different questions. Keeping the source and limits of each observation visible helps people interpret a connection without needing to read a network trace.

## What’s next

We want to explore a phone view and an Auth0-based consent firewall with revocable approvals. That would give users a way to act on what they discover.
