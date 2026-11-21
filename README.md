# Outbound

Outbound is a local Windows dashboard for seeing where desktop apps connect, which apps are talking over localhost, and when they use your microphone or camera. Click an app in Computer to inspect its destinations. Switch to Globe to see the estimated locations of those endpoints.

Built at Hack Western 13 for the **Discover the Unknown** theme.

![Outbound Computer view showing an observed direct TCP link between curl and Node.js](notes/backend-computer.png)

The screenshot is scoped to a real local curl-to-Node.js test connection. The connection details show port 4319.

## Setup

Use Windows 11, Node.js 24 and npm 11. Run the first two commands in PowerShell from the integrated project checkout. Run the third in a second terminal while the server is running.

```powershell
npm.cmd ci
npm.cmd start
Start-Process 'http://localhost:4317'
```

For the backend worktree, run `$env:PORT=4319; node server.js` and open `http://localhost:4319`.

## What Outbound measures

- **Connections.** Windows reports TCP sockets and process IDs. Outbound counts connecting and established sockets and keeps observed destinations visible for ten minutes after they disappear. A shared-company link means two apps were observed connecting to the same attributed owner. A direct link joins the two Windows processes on a matched localhost TCP connection.
- **Owners and geography.** Outbound combines the Windows DNS cache, reverse DNS, offline network ownership tables and offline IP geolocation. Hostnames and locations can be approximate or unavailable. An owner may be a cloud or CDN operator, and a shared DNS cache entry can describe multiple apps' traffic. If Windows withholds the DNS cache, you can restart in an elevated terminal to try to get more hostnames.
- **Trackers.** A badge signals a match against known domains or organization names. Each match is an attribution clue about the endpoint.
- **Device use.** Windows stores per-app microphone and camera timestamps. Outbound treats a zero stop time as active and computes today's time from overlapping intervals. History includes the most recent completed session Windows exposes per app plus sessions the dashboard has retained locally. Some capture paths, including browser automation tested with a script-launched Chrome instance, may use the hardware without producing those registry timestamps.

Polling can miss brief connections, including some short device sessions. UDP traffic such as QUIC is outside the TCP snapshot. The wires and arcs illustrate observed connections. Outbound captures neither packet payloads nor microphone or camera media, and it measures neither bytes nor traffic direction.

## Local data

The HTTP server binds to `127.0.0.1`. Network observations are held in memory, and device session history is saved to `data/usage.json` on the PC. Reverse DNS uses the Windows resolver. IP ownership and location data, the dashboard and its globe assets are served locally.

Use [DEMO.md](DEMO.md) for the live walkthrough and [DEVPOST.md](DEVPOST.md) for the submission draft.
