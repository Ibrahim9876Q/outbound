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
