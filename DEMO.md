# Outbound · Three-minute judged demo

Rehearse from the integrated Windows checkout. Keep Computer, Stored data and Globe ready. Confirm the policy page shows the local provider and dry-run enforcer. Use the opt-in results from this PC only after reviewing what will be visible on the projector. Start with real traffic already present or use the local fallback below.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:25 | Open **Stored data** and press **Scan this PC**. While it runs, point to Computer's live connections. | “On November 13, 2026, CBC Marketplace reported that the Tim Hortons app appeared to contact outside companies as soon as it opened. What can this laptop tell us about activity we'd otherwise miss?” |
| 0:25–1:05 | Return to Stored data. Open the permission history and a recent timestamped row, preferably for location or microphone. Point to one app-data or extension finding. | “On this PC on November 22, 2026, the scanner found 629 Windows permission entries across 23 capabilities. Windows preserved timestamps in 520 entries, so we can see past access after an app closes. This is an opt-in inventory of local metadata.” |
| 1:05–1:35 | Open **Dossier**, search **Tim Hortons**, and open the 2022 mobile location investigation. Point to the regulator and source link. | “The dossier puts a documented incident next to the company. This record is a Canadian privacy regulator's investigation. The result comes from the cited source, and our laptop scan is a separate observation.” |
| 1:35–2:10 | From an observed app's detail, choose its block preview. In Rules, preview the session rule and point to **DRY RUN**; remove the demo rule afterwards. | “Here's the rule we would generate for that app. This is a preview. We left Windows settings and the firewall alone.” |
| 2:10–3:00 | Switch to **Globe**, filter to one app, and follow its illustrated packets to a destination with a location estimate. Read the actual counts and open the attribution detail. | “These arcs animate observed connections. IP geolocation estimates the endpoint's location, and the attribution may name a network or CDN operator. The view lets us connect a live observation to the right question about an app.” |

[November 2026 CBC Marketplace report](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814) · [2022 Canadian privacy regulator release](https://www.priv.gc.ca/en/opc-news/news-and-announcements/2022/nr-c_220601/)

## Fallback appendix

- If the new scan is still running, show a completed opt-in scan from the rehearsal and identify when it was collected. If this frontend build shows only the older scan cards, read the relevant permission and inventory results from the local `/api/scan` response. The app-data walk continues when the first results are partial.
- If venue Wi-Fi stalls, use the already-observed destinations still retained within the time and per-app caps. If none have location estimates, use `curl.exe -N http://127.0.0.1:4317/events -o NUL` from a second terminal to create a real local connection, then show it in Computer or Links. Stop that curl with Ctrl+C. Use a rehearsal recording only if it was captured and checked before judging.
- If asked about device indicators, use a preapproved camera preview. The webcam lamp is white. The orange microphone key and the white lamp indicate Windows sessions, and durations reflect the observations.
- If asked about Phone, live Auth0 CIBA needs a Guardian-enrolled approver and a configured FGA store. Our hosted attempt reached CIBA and was blocked before push delivery because enrollment was missing. The gateway's explicit offline demo runs a real loopback DNS lookup with labeled simulated approvals. Follow the gateway's rehearsal steps. [Phone setup and offline fallback](gateway/README.md)
