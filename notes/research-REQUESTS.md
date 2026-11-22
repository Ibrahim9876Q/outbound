# Research and policy integration

- The app rule route now resolves running executables server-side when no path is supplied. Treat a plan row with an empty `command` as an explanation and render its `reason`. Multiple resolved executables produce multiple command rows.
- `research.json#index` has `exe` and `domain` maps. Lowercase executable basenames and remove a domain's final dot before lookup. For hostnames, try the full name before walking ancestor suffixes by DNS label. Values are arrays of app IDs, since several products can share a domain. A shared-domain match alone does not identify the app responsible for a connection.

- The policy route is wired into `server.js`. Mutation requests must have an origin matching the request host and port.
- Frontend owner: read `/data/research.json`. Null HQ/date or empty evidence sections mean no verified value. Distinguish publisher disclosures, incidents, and observed traffic.
- Company records may include `destinations`. Use an empty array when absent. These are policy disclosures about possible transfers. In FTC docket records, `year` identifies the earliest item in the cited timeline and `caseRef` is the FTC file number when available.
- Frontend owner: POST JSON to policy routes from the dashboard origin. Show pending or denied approvals and `plan[].applied` separately from policy action. Poll GET while approval is pending. For executable plans send `target.program` with a full path or use the full path as the app value. For company plans send only locally observed IPs in `target.addresses`.
