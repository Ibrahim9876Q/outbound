# Phone lane progress

## 2026-11-21 16:45 EST — Auth0 feasibility

The requested 30-minute research window begins at 16:45 EST. I am checking plan eligibility separately from API behavior and looking for a documented no-cost path for a live hackathon demo.

- Auth0 FGA has its own free trial with no current time limit. The trial supports Checks, Reads and Writes. The published Check limit is 20 requests per second per store. [Auth0 FGA plans](https://docs.fga.dev/subscription-plans)
- Standard Auth0 Free does not include CIBA. Auth0 documents temporary CIBA availability in a new tenant for testing and lists CIBA as a paid-plan feature or add-on. A newly created tenant with a working grant may still be in its trial. [Auth0 pricing](https://auth0.com/pricing) · [Auth0 CIBA guide](https://auth0.com/blog/building-secure-ai-agents-microsoft-agent-framework-auth0-part-4-human-in-the-loop-approval/)
- A scoped grant can carry an expiry condition enforced by FGA at check time. Auth0's CIBA flow sends an enrolled user a push, returns a polling interval and request expiry, and issues tokens only upon successful approval. [OpenFGA conditions](https://openfga.dev/docs/modeling/conditions) · [CIBA login API](https://auth0.com/docs/api/authentication/login/start-back-channel-login) · [CIBA polling API](https://auth0.com/docs/api/authentication/login/check-back-channel-login-status)
- Hosted API operation awaits a user-provisioned FGA store and a CIBA-enabled tenant with an enrolled user. There was no `.env` at the start of the research window.

The hosted setup requires a dedicated FGA store and an authorized client from its Settings page. The client needs to read, check and write the conditional grant tuples. On the identity tenant, a confidential Regular Web Application must have the CIBA grant enabled and the approver must be enrolled for Guardian push. The Auth0 application should use Client Secret (Post) and RS256. [FGA store settings](https://docs.fga.dev/intro/settings) · [CIBA tenant setup](https://auth0.com/blog/building-secure-ai-agents-microsoft-agent-framework-auth0-part-4-human-in-the-loop-approval/)

The CIBA specification allows an opaque binding reference that the user compares on both devices. This lets the dashboard show the tracker and the grant duration locally while Auth0 receives only the reference and the configured approver's identity. FGA will use pseudonymous tuple identifiers. Reads and checks will request higher consistency to pick up revocations promptly. [CIBA specification](https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0-final.html) · [OpenFGA query consistency](https://openfga.dev/docs/interacting/consistency)

For live verification, record the tenant's billing state before sending a request so trial access cannot be confused with Free-plan access. Start with a known tracker blocked, verify that denying a Guardian prompt leaves it blocked, approve a new request and confirm a fresh lookup succeeds, then check revocation and expiry independently. Check the ordinary DNS route with the phone pointed at the gateway on an existing private adapter. [Apple Wi-Fi DNS settings](https://support.apple.com/guide/iphone/manage-wi-fi-settings-iphw5gjwl8k2/27/ios/27) · [Android network settings](https://support.google.com/android/answer/9654714?hl=en)

The research window elapsed before implementation. No `.env` was available at its close, so the eligibility conclusions are from the published plans and no hosted requests were made.

## 2026-11-21 18:25 EST — DNS gateway and Phone view

Build and run the standalone gateway in `gateway/` and serve the Phone view from `public/phone.js` and `public/phone.css`. Verify UDP and TCP forwarding and default-deny using loopback, then check the dashboard and its live data contract.

Verified the live gateway serves HTML, CSS, JS and JSON on 4320. A loopback query for `example.com` used Windows' configured DNS resolver and returned addresses. A query for `google-analytics.com` returned REFUSED and appeared as blocked in the feed. The DNS regression test also exercised TCP, alias blocking, and zero TTL for permitted tracker responses.

Rubric (phone scope): truthful 5, live 4, readability 4, visual impact 3, demo readiness 3, performance 3, code quality 4. The next iteration adds a visible Guardian approval state and allows timing the completed gateway. A physical phone and hosted Auth0 account remain pending.
