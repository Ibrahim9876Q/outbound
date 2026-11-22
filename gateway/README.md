# Outbound Phone

## Laptop-only consent demo

Stop any gateway already using port 4320, then run `node gateway/server.js --demo` and open the [Phone dashboard](http://127.0.0.1:4320/).

1. Click **Look up tracker** to see a blocked lookup.
2. Click **Request demo approval**, then **Deny demo request**. Look up the tracker again to confirm it is blocked.
3. Request approval again and click **Approve demo request**. Look up the tracker to see the approved DNS response.
4. Click **Revoke**, then look up the tracker again. A one-minute approval also expires automatically.

The **DEMO DATA** banner identifies simulated Auth0 decisions. The gateway processes actual loopback DNS requests and uses an offline fixture answer. Demo approvals stay in memory and reset on restart.

With both providers configured, the same command runs live consent with a laptop DNS test button. Select **Ask Guardian**, respond on the enrolled phone before the countdown expires, then repeat the lookup. The demo decision buttons are available only with the offline fallback.

Run the gateway from the repo root with Node 24 and open the [Phone dashboard](http://127.0.0.1:4320/).

```powershell
node gateway/server.js
```

The dashboard listens on the PC's loopback address at port **4320**. The default DNS listener uses UDP and TCP at `127.0.0.1:5354` so you can test it without changing networking settings. The gateway uses Windows' configured DNS resolvers for ordinary lookups. Known trackers stay blocked while Auth0 is unconfigured.

## Connect a phone

1. Copy `.env.example` to the gitignored `.env` if it does not already exist.
2. On an existing WireGuard tunnel or private Windows hotspot, set `PHONE_DNS_HOST` to the PC's IPv4 address on that adapter and `PHONE_DNS_CLIENT` to the phone's IPv4 address. Leave `PHONE_DNS_PORT` blank for port 53. If the hotspot already occupies port 53, use a WireGuard adapter with port 53 available.
3. Restart the gateway. Set the phone's DNS server to the PC's adapter address. With WireGuard, use that address for the phone tunnel's DNS and include it in the peer's allowed addresses. Use a fresh DNS lookup to verify that the dashboard receives traffic. [iPhone Wi-Fi settings](https://support.apple.com/guide/iphone/manage-wi-fi-settings-iphw5gjwl8k2/27/ios/27) · [Android network settings](https://support.google.com/android/answer/9654714?hl=en)

## Enable Auth0 consent

To publish the bundled model from the laptop, first fill `FGA_API_URL`, `FGA_STORE_ID`, `FGA_CLIENT_ID` and `FGA_CLIENT_SECRET` in `.env`. Run `node gateway/fga-model.js` with a store client that can write models, then paste the printed `FGA_MODEL_ID` line into `.env`.

1. Create an Auth0 FGA store. In Model Explorer, publish [consent.fga](consent.fga). In store Settings, create an authorized client that can read and write tuples and perform checks. Paste the regional API URL, store ID, published model ID, client ID and secret into `.env`. [FGA models](https://docs.fga.dev/intro/models) · [FGA store settings](https://docs.fga.dev/intro/settings)
2. Create an Auth0 tenant with CIBA trial or paid access. Create a **Regular Web Application** with **Client Secret (Post)** authentication and RS256 signing. Enable the **Client Initiated Backchannel Authentication** grant and Guardian push. Create a test approver and enroll their device in Guardian through Universal Login. Paste the tenant hostname, application credentials and enrolled user's `user_id` into `.env`. [Auth0 CIBA setup](https://auth0.com/blog/building-secure-ai-agents-microsoft-agent-framework-auth0-part-4-human-in-the-loop-approval/)
3. Generate `PHONE_POLICY_KEY` with the command below and keep it in `.env`. Leave the same key in place across restarts so the gateway can match existing grants. Restart the gateway after filling the settings.

```powershell
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

FGA has a separate free trial. The standard Auth0 Free plan excludes CIBA. Auth0 documents temporary CIBA access for new tenants used for testing. [FGA plans](https://docs.fga.dev/subscription-plans) · [Auth0 pricing](https://auth0.com/pricing) · [CIBA testing access](https://auth0.com/blog/building-secure-ai-agents-microsoft-agent-framework-auth0-part-4-human-in-the-loop-approval/)

## Demo the firewall

1. Send a DNS lookup for an ordinary domain and a known tracker such as `google-analytics.com`. The latest lookups appear in the feed. The tracker starts blocked.
2. Select **Ask Guardian** in Tracker permissions. In Guardian, confirm the reference matches the one beside the tracker, then approve or deny. Denial leaves the tracker blocked. Approval allows future DNS lookups for that tracker suffix until the listed expiry. The default grant lasts 15 minutes.
3. Select **Revoke** on an approved tracker and make a fresh lookup. The gateway refuses the lookup again.

For a local DNS-only rehearsal, run these PowerShell commands with the gateway using the default loopback binding.

```powershell
@'
const { Resolver } = require('node:dns/promises');
const dns = new Resolver({ tries: 1, timeout: 2500 });
dns.setServers(['127.0.0.1:5354']);
(async () => {
  for (const domain of ['example.com', 'google-analytics.com']) {
    try { console.log(domain, await dns.resolve4(domain)); }
    catch (error) { console.log(domain, error.code); }
  }
})();
'@ | node -
```

The feed stays in memory. FGA stores opaque tracker and user IDs and the grant expiry. Guardian receives a matching reference and the configured user's identity. The gateway remembers approved domain labels in gitignored `data/phone-consent.json` so it can display them after restart.

The gateway filters DNS that reaches its listener. Encrypted DNS, other resolvers, cached addresses and direct IP connections can bypass it. Revocation applies to future lookups through the gateway. DNS does not identify the requesting app, inspect payloads, or terminate existing connections.

## Verify locally

```powershell
node --test --test-isolation=none gateway/dns.test.js gateway/consent.test.js
```

The test suite uses loopback DNS and local Auth0 response fixtures. Live hosted verification requires your FGA store, CIBA-enabled tenant and Guardian enrollment.
