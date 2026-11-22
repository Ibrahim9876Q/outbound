# Outbound live demo

## Before the 3-minute timer

Open the local dashboard and dismiss **Skip startup** if it is still visible. Click **Stored data** → **Scan this PC**. Wait for the completed scan, then choose one shareable row with a recorded start time under **Permission history**. The last completed result can be reopened from the local cache after a restart. Close tabs and notifications that would expose private data.

In **Rules**, confirm the page shows the local decision provider and the dry-run enforcer. Choose a visible app tile with an executable path and rehearse its preview. Remove any rehearsal rule before starting. Return to **Computer** and clear the previous selection if it is still open. Use only counts and destinations the screen shows.

## 3-minute script

| Clock | Click and point | Say | Fallback |
| --- | --- | --- | --- |
| 0:00–0:25 | Start on **Computer**. Click a rehearsed app tile and point to one destination in its detail panel. | “CBC Marketplace reported that the Tim Hortons app appeared to contact outside companies as soon as it opened. What could we discover about a laptop? This is an observed Windows connection, with the destination owner shown when we can attribute it.” | If traffic is sparse, leave **Computer** on screen and point to the observed mic and camera status or a retained destination marked closed. |
| 0:25–1:00 | Click **Stored data**. Point to the scan summary, then click **Permission history** and point to your reviewed row and timestamp. | “This scan runs by choice. Outbound compares visited domains to a public tracker dataset. Windows also records when an app last started using a permission. This timestamp is the registry’s record of use.” | If a new scan is running, use **Previous scan** and its finish time when shown. If no timestamps are available, show the completed scan’s browser summary or the actual warning, then move on. |
| 1:00–1:30 | Click **Dossier**. In **Search**, type **Tim Hortons**, then click **Tim Hortons** in **Research index**. Point to **Tim Hortons mobile location investigation** and its regulator source. | “This is a separate piece of evidence, a 2022 investigation by Canadian privacy regulators. The source is attached to the finding so we can check what the regulator actually reported.” | If search is slow, click **Tim Hortons dossier** under **Permission history** when that link is present. If necessary, show the saved public regulator source. |
| 1:30–2:15 | Click **Computer**. If the rehearsed app’s detail panel is closed, click its tile. Click **Block app** → **Preview block**. Point to **DRY RUN** and the command, then point to the CIBA and FGA steps on **Rules**. | “This is the Windows command Outbound would run for this app. This preview leaves the firewall alone. A configured Auth0 flow requests consent via CIBA and writes an approval relation in FGA when the approver agrees. We verified the policy logic with fixtures. Hosted approval and revocation still need an end-to-end run.” | If the preview is slow or no command is available, show the actual **Rules** provider and enforcer status, then click **Globe** at 2:15. |
| 2:15–3:00 | From the preview click **Show app on globe**. In **Countries your data reaches**, click a country row to open the attribution detail. | “The arcs illustrate observed connections. IP geolocation estimates where an endpoint is. The owner might be a network or CDN. Outbound lets us start with one app, find a destination we didn’t expect, and see the evidence for it.” | Click **All apps** under **Filter by app** if the selected app has no mapped destinations. If the globe has no usable locations, show the actual app connections in **Computer** and say that locations are unavailable. |

After the timer, return to **Rules** and click **Remove** on the rule created during the demo.

[November 2026 CBC Marketplace report](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814) · [2022 Canadian privacy regulator release](https://www.priv.gc.ca/en/opc-news/news-and-announcements/2022/nr-c_220601/)

## Fallback appendix

- Keep a reviewed completed local scan available before presenting. Use its displayed finish time. For a recording, use an actual rehearsal and disclose when it was recorded.
- Use the current status or a retained observation when live activity is sparse. Globe packets illustrate socket observations. The display has no payload or byte counts.
- If the panel asks to see device indicators, use only a preapproved camera or microphone preview. The white camera lamp and orange microphone key reflect Windows observations.
- For Auth0 questions, the local preview works without hosted approval. The reported hosted attempt stopped at Guardian enrollment before push delivery. The separate Phone offline demo labels its fixture DNS answers and simulated approvals. Use the hosted path only after verifying it with an enrolled device. [Phone setup](gateway/README.md)
