# Auth0 setup for Outbound

The dashboard runs locally with the local policy provider when Auth0 variables are unset. This setup enables dashboard sign-in and Guardian approval for desktop policy while keeping firewall enforcement in dry-run mode.

**Nine-minute setup target.** Before starting, have an Auth0 tenant with the CIBA grant available, an Auth0 FGA account with store-creation access, and a test user already enrolled in Guardian push. Tenant entitlement, email delivery, and first-time phone enrollment depend on Auth0 and the approver. The times below are a checklist budget.

## Minutes 0–3 · Auth0 application

1. In **Applications → Applications → Create Application**, create a **Regular Web Application**. In **Settings**, set **Allowed Callback URLs** to `http://127.0.0.1:4317/auth/callback` and **Allowed Logout URLs** to `http://127.0.0.1:4317/`. In **Advanced Settings → OAuth**, select **RS256** for JSON Web Token Signature Algorithm. Set the token endpoint authentication method to **Client Secret (Post)**.
2. Under **Advanced Settings → Grant Types**, keep **Authorization Code** enabled and enable **Client Initiated Backchannel Authentication (CIBA)**. Save the application. CIBA must be available for your tenant. Under **Security → Multi-factor Auth**, enable **Push Notification using Auth0 Guardian**. [Auth0 CIBA and Guardian setup](https://auth0.com/blog/building-secure-ai-agents-microsoft-agent-framework-auth0-part-4-human-in-the-loop-approval/)
3. Under **User Management → Users**, create or select the test approver. On the user's page, use **Actions → Send an MFA Enrollment Email**, or use Universal Login with an MFA policy requiring enrollment. The approver opens the enrollment flow, scans the QR code with Auth0 Guardian, and completes enrollment. Copy the user's full **User ID** into `AUTH0_USER_ID`. Sign-in identifies the rule author. CIBA always sends approval to this separately configured approver.

## Minutes 3–6 · Auth0 FGA store

1. Create a store in the [Auth0 FGA dashboard](https://dashboard.fga.dev/). In **Model Explorer**, paste [outbound-policy.fga](outbound-policy.fga) and publish it. Copy the resulting model ID to `OUTBOUND_FGA_MODEL_ID`.
2. In the store's **Settings → Authorized Clients**, create a client with **Write Tuples** and **Query** permissions. Copy the API endpoint, store ID, client ID and secret. The model has a `user` type and direct `blocked` relations on `app`, `company` and `domain`. The `policy_rule#approved` relation supports allow/ask rules, IP rules, and rules created with the earlier model. Object IDs are opaque rule UUIDs. The browser's signed-in subject and target labels stay in local policy storage. [FGA settings](https://docs.fga.dev/intro/settings), [FGA models](https://docs.fga.dev/intro/models)
3. The separate DNS gateway uses its own `FGA_MODEL_ID` and tracker-consent model. Use a separate FGA store for desktop policy if both features will run with different store credentials.

## Minutes 6–9 · Local settings and preflight

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

From the repository root, run the first command to check the configured tenant and FGA model, then run the second to start the dashboard. The preflight fetches OIDC discovery and signing keys, obtains an FGA client token, and checks a fresh synthetic domain object. It prints only the result and creates no rules or phone requests.

```powershell
node --env-file=.env research/auth0-check.js
node --env-file=.env server.js
```

Open `http://127.0.0.1:4317/`. If you choose a different `PORT`, update both allowlisted URLs and use the same port in the browser. Click **Sign in with Auth0**, complete Universal Login, and open **Rules**. The approval panel should show the provider configured. Sign-in uses an HTTP-only SameSite=Lax session cookie.

When the preflight flags FGA, check that you copied the **desktop** model ID and the regional API of the same store, then confirm the client has Query and Write Tuples permissions. When a rule says the approver is missing Guardian enrollment, open the enrollment email, scan the QR code, finish the app prompt, and retry.

## Thirty seconds with the judges

1. Sign in before the timer. Show the Auth0 identity in the header. Say, “This verified Auth0 subject becomes the local rule author.”
2. In **Dossier**, open Google Chrome and choose **Block domain**. In **Rules**, click **Preview block**. Match the displayed reference to the Guardian push and approve. Say, “The browser waits for phone approval and the push carries an opaque reference.”
3. Show **Phone approval granted** and the dry-run result. To verify FGA separately, open `/api/policy` locally, copy the rule ID, and use the FGA Query Tool to check whether `user:laptop` is related to `domain:<rule UUID>` as `blocked`.

For a direct API check in the signed-in browser, submit the JSON below and poll the returned request ID after the indicated interval.

```js
const pending = await fetch('/api/policy/rules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'block', scope: 'session', target: { kind: 'domain', value: 'example.org' } }),
}).then((response) => response.json());
console.log(pending);
await fetch('/api/policy/requests/' + pending.requestId).then((response) => response.json());
```
