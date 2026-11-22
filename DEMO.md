# Outbound live demo

**Three minutes, followed by one minute of questions.**

Before presenting, start Outbound from the integrated project and open Computer. Close private apps and tabs, choose one app to open live, and check which destinations your machine can show. Test the camera and microphone preview with the presenter's permission. Keep a second terminal ready and leave the server running throughout.

## 0:00–0:30 · The hook

“Last week, CBC Marketplace reported that the Tim Hortons app appeared to send data to outside companies as soon as it opened. What is your laptop doing right now?” [CBC Marketplace investigation](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814)

Point to the laptop and the connected apps already on its screen. “Outbound shows where Windows apps connect and when they use your microphone or camera.”

## 0:30–1:30 · Watch a connection appear

Open the rehearsed app. Return to Computer, point to a new company chip or live wire, and click the app. Read the actual company and country from the destination panel. “Windows reported a connection from this app to this endpoint. Outbound uses the hostname or the network owner to put a name on it.” If a tracker appears, point at its badge. If a direct link appears, click either app and show its local peer.

## 1:30–2:15 · Make the devices visible

Open the video-call preview and enable both devices. Return to Outbound while the preview stays open. Point to the green camera LED and orange mic key, then read the app label. Close the preview and show the devices returning to idle and the usage cards updating.

“Outbound observed when the app started and stopped using the devices. That gives us the session duration you see here.”

## 2:15–2:50 · Follow a destination

Switch to Globe. Tell the judges the country count actually on screen, then filter to the app you just opened and hover a point. “This is where the endpoint's IP address maps. The globe shows endpoint estimates for the connections Outbound has recently observed.”

## 2:50–3:00 · What’s next

“Next we want to bring this view to phones and explore an Auth0 consent firewall so people can act on what they discover.”

## If venue Wi-Fi is slow

- Use destinations already observed in the current run within the last ten minutes. The UI, globe assets and offline IP tables load locally.
- To show a real direct connection offline, run `curl.exe -N http://127.0.0.1:4317/events -o NUL` in the second terminal. Back in Computer, show the cURL-to-Node.js link. Press Ctrl+C after the demo.
- Use the Windows Camera app for a local camera preview if the call preview stalls. If no external destinations are available, show the most recent available observation or say the globe is waiting for connections. Keep a labelled recording of a real rehearsal for the live sequence if the machine or display fails.

## One minute of questions

- **Can you see what the app sends?** Outbound reads metadata from Windows TCP snapshots. The animation illustrates connections and the app never inspects payloads.
- **Does the company label identify who receives the data?** It's an attribution from the DNS name or the registered network owner, which can be a cloud or CDN provider. Geolocation estimates describe IP endpoints.
- **What happens to the observations?** The dashboard is available only on the PC. Device session history is saved locally, and connection history is held in the running process.

# Outbound demo

## Phone consent firewall

Before judging, start `node gateway/server.js --demo` and open the desktop dashboard's **Phone** link or [localhost:4320](http://127.0.0.1:4320/). For live Auth0, keep the enrolled phone unlocked and check that startup reports `Mode: live`. Start with no active approval for the test tracker.

| Time | Click | Say |
| --- | --- | --- |
| 0:00–0:20 | **RUN CONSENT SELF-TEST** | “Outbound just sent a real DNS lookup to the gateway. The tracker is blocked, and Outbound has requested approval.” |
| 0:20–0:50 | In live mode, match the reference and approve in Guardian. In offline mode, click **Approve demo request**. | Live: “Auth0 CIBA sent this request to my enrolled phone. The gateway polls while the countdown runs.” Offline: “The banner marks the simulated Auth0 decision. This laptop is still making real loopback DNS requests.” |
| 0:50–1:10 | Point to **APPROVED** and the FGA check in the terminal. | “The gateway retried DNS and checked the grant. Its expiry limits how long this tracker can resolve.” |
| 1:10–1:30 | Expand **How Auth0 powers tracker consent**. | “CIBA gets the decision. FGA stores the per-tracker grant and its expiry. Revoking consent deletes that tuple.” |
| 1:30–1:50 | Click **Revoke**, then **Look up tracker**. Point to the new **Blocked** row. | “That same tracker is blocked again on the next lookup.” |

For a denial rehearsal, press **RUN CONSENT SELF-TEST** and deny in Guardian or click **Deny demo request**. The terminal stops at **DENIED** and **Look up tracker** confirms the block. If a live request fails, switch to the labeled offline demo before judging by starting the same command with the provider settings absent.
