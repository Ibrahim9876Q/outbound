# Auth0 setup for Outbound

The dashboard runs locally with the local policy provider when Auth0 variables are unset. These steps enable dashboard sign-in and managed phone approval for desktop policy. Keep the desktop in dry-run mode for the demo.

## Auth0 dashboard

1. In **Applications → Applications → Create Application**, create a **Regular Web Application**. In **Settings**, set **Allowed Callback URLs** to `http://127.0.0.1:4317/auth/callback` and **Allowed Logout URLs** to `http://127.0.0.1:4317/`. In **Advanced Settings → OAuth**, select **RS256** for JSON Web Token Signature Algorithm. Set the token endpoint authentication method to **Client Secret (Post)**.
2. Under **Advanced Settings → Grant Types**, keep **Authorization Code** enabled and enable **Client Initiated Backchannel Authentication (CIBA)**. Save the application. CIBA must be available for your tenant. Under **Security → Multi-factor Auth**, enable **Push Notification using Auth0 Guardian**. [Auth0 CIBA and Guardian setup](https://auth0.com/blog/building-secure-ai-agents-microsoft-agent-framework-auth0-part-4-human-in-the-loop-approval/)
3. Under **User Management → Users**, create or select the test approver. On the user's page, use **Actions → Send an MFA Enrollment Email**, or use Universal Login with an MFA policy requiring enrollment. The approver opens the enrollment flow, scans the QR code with Auth0 Guardian, and completes enrollment. Copy the user's full **User ID** into `AUTH0_USER_ID`. Sign-in identifies the rule author. CIBA always sends approval to this separately configured approver.

## Auth0 FGA dashboard

1. Create a store in the [Auth0 FGA dashboard](https://dashboard.fga.dev/). In **Model Explorer**, paste [outbound-policy.fga](outbound-policy.fga) and publish it. Copy the resulting model ID to `OUTBOUND_FGA_MODEL_ID`.
2. In the store's **Settings → Authorized Clients**, create a client with **Write Tuples** and **Query** permissions. Copy the API endpoint, store ID, client ID and secret. The model has a `user` type and direct `blocked` relations on `app`, `company` and `domain`. The `policy_rule#approved` relation supports allow/ask rules, IP rules, and rules created with the earlier model. Object IDs are opaque rule UUIDs. The browser's signed-in subject and target labels stay in local policy storage. [FGA settings](https://docs.fga.dev/intro/settings), [FGA models](https://docs.fga.dev/intro/models)
3. The separate DNS gateway uses its own `FGA_MODEL_ID` and tracker-consent model. Use a separate FGA store for desktop policy if both features will run with different store credentials.

## Local environment

Enter the values yourself in gitignored `.env`. Generate a 32-byte dashboard cookie signing key with `node -p "require('node:crypto').randomBytes(32).toString('hex')"`.

| Variable | Value |
| --- | --- |
| `AUTH0_LOGIN` | `1` to enable dashboard sign-in |
| `AUTH0_DOMAIN` | The tenant hostname under `auth0.com`, with no scheme or trailing slash |
| `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` | Regular Web Application credentials |
| `AUTH0_SESSION_KEY` | The generated 64-character hex key |
| `AUTH0_USER_ID` | The Guardian-enrolled approver's full Auth0 user ID |
| `FGA_API_URL` | The regional FGA API endpoint from the store |
| `FGA_STORE_ID` | The desktop policy store ID |
| `FGA_CLIENT_ID`, `FGA_CLIENT_SECRET` | The desktop store client credentials |
| `OUTBOUND_FGA_MODEL_ID` | The published desktop policy model ID |
| `OUTBOUND_ENFORCE` | `dry-run` for the demo |

Launch with `node --env-file=.env server.js` and open `http://127.0.0.1:4317/`. If you choose a different `PORT`, both allowlisted URLs must use that port. The session cookie is HTTP-only and SameSite=Lax and expires with the signed ID token or after eight hours, whichever comes first.

## Thirty seconds with the judges

1. Open `/auth/login`, sign in through Universal Login, and show the signed-in identity through `/auth/me` or the dashboard's sign-in control when wired. Say, “This verified Auth0 subject becomes the local rule author.”
2. Submit a block rule for a domain from the policy panel. Point to the pending reference and match it to the Guardian push. Approve on the phone. Say, “The browser polls while the approver decides. The push carries a reference instead of the target's name.”
3. Show the approved response and the local plan result. In FGA Query Tool, check whether `user:laptop` is related to `domain:<rule UUID>` as `blocked`. Say, “FGA confirms approval. Outbound shows a dry-run plan and leaves the Windows firewall alone.”

If the UI controls have not been wired, use the same browser's console after signing in. Submit the JSON below, show the returned `bindingMessage`, and retry the request URL after the returned `retryAfterMs` until it reports a terminal status.

```js
const pending = await fetch('/api/policy/rules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'block', scope: 'session', target: { kind: 'domain', value: 'example.org' } }),
}).then((response) => response.json());
console.log(pending);
await fetch('/api/policy/requests/' + pending.requestId).then((response) => response.json());
```
