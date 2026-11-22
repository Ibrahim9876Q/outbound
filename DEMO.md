# Outbound live demo

**Three minutes, followed by one minute of questions.**

Before judging, open Computer and the Phone dashboard in separate tabs. Rehearse a video-call preview, start with no active grant for the test tracker, and keep the Guardian phone unlocked in live mode. For a clean Globe comparison, use a fresh desktop run and a Chrome window with background tabs closed. Keep a recording of the real weather.com rehearsal available if venue Wi-Fi stalls.

## 0:00–0:25 · Hook

“CBC Marketplace reported that the Tim Hortons app appeared to contact outside companies as soon as it opened. What could we discover by opening one page on this laptop?” Point to Computer and its live app connections. [CBC Marketplace investigation](https://www.cbc.ca/news/canada/app-data-privacy-9.7417814)

## 0:25–0:55 · Live microphone and camera

Start the rehearsed call preview with the mic and camera enabled and switch straight back to Computer. Point to the mic key and webcam indicator as they react, then read the app name. Close the preview and show both returning to idle. “Outbound saw that app pick up both devices and recorded how long it used them.”

## 0:55–1:45 · Discover the unknown on Globe

Switch to Globe and show the starting count with Chrome selected once its filter is available. Open `weather.com` in Chrome, or the ad-funded news site shortlisted in rehearsal, and return to Globe. Give Outbound a few seconds to populate. Point to the arcs, read the actual on-screen counts, and click a country or destination to reveal an attributed owner.

“On our laptop, one load of weather.com produced connections attributed to 38 companies in 13 countries, with at least seven flagged tracker companies. These are estimates for the observed endpoints.” If the live page yields fewer destinations, report that result and use the labeled rehearsal recording for the measured run.

## 1:45–3:00 · Phone Auth0 consent firewall

- **1:45–2:05** — Switch to Phone and press **RUN CONSENT SELF-TEST**. Point to the blocked lookup and the approval request.
- **2:05–2:35** — In live mode, match the reference and approve in Guardian. Point to **APPROVED** and the successful retried lookup. “Auth0 CIBA asks for consent. FGA stores the tracker grant and its expiry.” If credentials or Wi-Fi are unavailable, use the labeled offline demo and explicitly identify its simulated Auth0 decision. The loopback DNS lookup still runs.
- **2:35–3:00** — Click **Revoke**, then **Look up tracker**. Point to **Blocked**. “Once the grant is revoked, the same DNS lookup is blocked again.”

## One minute of questions

- **What does the globe measure?** Windows TCP snapshots yield the connections. The country is an IP geolocation estimate and the owner may be a cloud provider or CDN.
- **How does the phone piece work?** The gateway checks the DNS request against tracker permissions. Revocation takes effect on the next lookup through the gateway.
- **Where is the desktop data stored?** Connection observations live in memory. Device sessions are saved locally.

## Phone consent firewall

Appendix. Use this expanded click table for rehearsal and questions.

Before judging, start `node gateway/server.js --demo` and open the desktop dashboard's **Phone** link or [localhost:4320](http://127.0.0.1:4320/). For live Auth0, keep the enrolled phone unlocked and check that startup reports `Mode: live`. Start with no active approval for the test tracker.

| Time | Click | Say |
| --- | --- | --- |
| 0:00–0:20 | **RUN CONSENT SELF-TEST** | “Outbound just sent a real DNS lookup to the gateway. The tracker is blocked, and Outbound has requested approval.” |
| 0:20–0:50 | In live mode, match the reference and approve in Guardian. In offline mode, click **Approve demo request**. | Live: “Auth0 CIBA sent this request to my enrolled phone. The gateway polls while the countdown runs.” Offline: “The banner marks the simulated Auth0 decision. This laptop is still making real loopback DNS requests.” |
| 0:50–1:10 | Point to **APPROVED** and the FGA check in the terminal. | “The gateway retried DNS and checked the grant. Its expiry limits how long this tracker can resolve.” |
| 1:10–1:30 | Expand **How Auth0 powers tracker consent**. | “CIBA gets the decision. FGA stores the per-tracker grant and its expiry. Revoking consent deletes that tuple.” |
| 1:30–1:50 | Click **Revoke**, then **Look up tracker**. Point to the new **Blocked** row. | “That same tracker is blocked again on the next lookup.” |

For a denial rehearsal, press **RUN CONSENT SELF-TEST** and deny in Guardian or click **Deny demo request**. The terminal stops at **DENIED** and **Look up tracker** confirms the block. If a live request fails, switch to the labeled offline demo before judging by starting the same command with the provider settings absent.
