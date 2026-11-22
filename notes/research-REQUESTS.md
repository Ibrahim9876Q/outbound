# Research and policy integration

- The app rule route now resolves running executables server-side when no path is supplied. Treat a plan row with an empty `command` as an explanation and render its `reason`. Multiple resolved executables produce multiple command rows.
- `research.json#index` has `exe` and `domain` maps. Lowercase executable basenames and remove a domain's final dot before lookup. For hostnames, try the full name before walking ancestor suffixes by DNS label. Values are arrays of app IDs, since several products can share a domain. A shared-domain match alone does not identify the app responsible for a connection.

- Backend owner: make the HTTP callback in `server.js` async and add the exact contract hook before static fallback. The current callback is synchronous, so adding the allowed line alone creates a parse error. The policy handler is ready for the hook.
- Frontend owner: read `/data/research.json`. Null HQ/date or empty evidence sections mean no verified value. Distinguish publisher disclosures, incidents, and observed traffic.
- Frontend owner: POST JSON to policy routes from the dashboard origin. Show pending or denied approvals and `plan[].applied` separately from policy action. Poll GET while approval is pending. For executable plans send `target.program` with a full path or use the full path as the app value. For company plans send only locally observed IPs in `target.addresses`.
