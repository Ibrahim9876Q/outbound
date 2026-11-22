# Globe cross-lane requests

- [ ] xray2 backend integration: mount the existing `lib/blocker/routes` handler in the loopback desktop server using the contract hook. The unmodified server returns 404 for `/api/policy`. The frontend shows an unavailable state. A test-only adapter exercised the real dry-run handler against an isolated temporary store.

- [ ] Integration should keep the Phone assets available wherever the shared index references them. The Globe branch preview uses the two existing Phone assets from `integration` as browser-only overrides to avoid missing-file errors.
