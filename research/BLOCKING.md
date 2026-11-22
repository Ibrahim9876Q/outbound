# Local policy and optional Auth0

The desktop defaults to a local approval provider and dry-run. Always rules are stored in `data/policy.json`; session rules live in the server process. Matching prefers domain, then company, then app, then IP. Newer rules win within a target kind. A domain covers its subdomains. The decision API reports policy intent.

Plan commands use Windows Firewall outbound block rules. An executable target needs a full Windows executable path, either as its value or as `target.program` beside the app label. A company requires explicit locally observed `target.addresses` with IP or CIDR values. No address is resolved or sent elsewhere by the blocker. An owner can share an IP with unrelated services. Windows Firewall cannot express hostname rules or guarantee the same precedence as the policy evaluator. Domain rules, allows, unresolved company names, and session rules do not install a persistent block.

The enforcer can execute commands only on Windows when the operator explicitly starts with `OUTBOUND_ENFORCE=firewall` in an already-elevated process. No elevation prompt is launched. The GET endpoint always previews. Use DELETE from an equivalently configured elevated process to remove an installed rule. No firewall commands were executed during development.

## Connect Auth0 later

Supply `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_USER_ID`, `FGA_API_URL`, `FGA_STORE_ID`, `FGA_CLIENT_ID`, `FGA_CLIENT_SECRET`, and `OUTBOUND_FGA_MODEL_ID` through the server process environment. If using a local gitignored file, you can start Node with `--env-file=.env`. Use an already-enrolled Guardian user, a CIBA-enabled Auth0 application, and a dedicated FGA model with this shape.

```fga
model
  schema 1.1

type user

type policy_rule
  relations
    define approved: [user]
```

The rule object and CIBA reference are opaque random IDs. App names, app paths, companies, IPs, domains and traffic stay on the PC. The rule type intentionally represents the approval of a local policy change. App and company target details remain in the local rule. Guardian approval writes an `approved` tuple, and each API check verifies that relation. Denial and approval failures leave no effective block. Use a separate model ID from the phone gateway.
