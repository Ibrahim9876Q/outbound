# Phone lane lessons

- Verify FGA and CIBA entitlements independently. FGA has a separate trial, and a new Auth0 tenant may have temporary CIBA access beyond the standard Free plan.
- Keep dashboard HTTP on loopback. Standard phone DNS settings use port 53, so use a separate DNS listener on the specific hotspot or WireGuard address.
- Treat DNS activity as lookups. A successful lookup alone cannot identify the app or prove a connection occurred.
- Use Node's resolver with an explicit loopback port for a Windows smoke test. The Windows `nslookup -port` invocation did not reach the gateway on this machine.
- Run the Node test runner with `--test-isolation=none` in this sandbox to avoid its worker-spawn restriction.
