# Outbound judge QA · November 22, 2026

## Rehearsal

Tested integrated commit `edaf902` on Windows with headless Chrome and SwiftShader at 1280×800 and 1920×1080. Each viewport started a new real scan through **Scan this PC**. The browser could load only the owned loopback server on port 4319. Source links were inspected without opening remote pages. The dry-run preview created and removed its own local rule. The Phone gateway and physical devices were outside this rehearsal.

The server listened after **764 ms**. The first completed sample with active connections arrived after **1.510 s**, with eight app rows. In a short idle sample before browser launch, the Node process used **6.33% of one CPU core** over **17.0 s** and had a **220.6 MiB** working set at the end. The idle interval includes sampling overhead and excludes collector child CPU.

| Original DEMO.md slot | 1280×800 | 1920×1080 |
| --- | --- | --- |
| 0:00–0:25 · Start scan, return to Computer | 0.16 s to click and return. Eight icons rendered. | 0.13 s to click and return. 44 icons rendered. |
| 0:25–1:05 · Permission history | 2.22 s after entering the slot. First scan result at 20.272 s. | 15.81 s after entering the slot. First scan result at 40.221 s. |
| 1:05–1:35 · Dossier incident | 0.04 s to open the Tim Hortons investigation and verify the regulator link. | 0.04 s, with the same incident and link present. |
| 1:35–2:10 · Local dry-run preview | 1.94 s to approve the preview, see a command, and remove the test rule. | 3.73 s for the same sequence. |
| 2:10–3:00 · Globe | 1.50 s to canvas and controls, with 30 app filters and three country controls. | Canvas already existed. Filters and country controls were empty on the first check; readiness required waiting for the controls as well. |

Times measure browser actions and waits within each slot. Narration was reviewed separately. First useful Computer render after navigation took **539 ms** and **706 ms**. Both viewports fit without horizontal overflow. Chrome recorded zero HTTP errors and zero external page requests. It recorded three runtime exceptions through the first walkthrough and one more through the second. A follow-up captured a skipped View Transition rejecting with `AbortError`.

Both scans reported **629 permission records across 23 capabilities**, **520** with recorded starts, **497 visited domains**, and **104** visited domains with public tracker matches. Both first results still had a background folder walk. One cache completion was measured at **76.749 s** from scan start. The original provisional response was **757,152 bytes** uncompressed.

## Ranked issues

| Rank | Reproduction and evidence | File hint | Fix and owner |
| --- | --- | --- | --- |
| 1 | Follow the block slot and look for Auth0 approval. The observed provider is local and both commands are dry runs. This supports a desktop policy preview. Hosted CIBA delivery, FGA grant creation and revocation were outside local QA. | `DEMO.md`, `DEVPOST.md`, `gateway/README.md` | Backend docs now distinguish the desktop path, labeled offline gateway demo, fixture coverage and unverified hosted path. A real sponsor demonstration needs an enrolled approver and a verified hosted sequence. |
| 2 | Start a fresh scan in the hook and reopen Stored data at 0:25. On the second run, the permission reveal waited 15.81 s into its 40-second slot. Starting over also replaces the previous result, so that run cannot be retrieved from the same scan panel as a fallback. | `DEMO.md`, `lib/scan/worker.js`, `public/intel.js` | Backend now publishes completed source sections as they arrive. The revised script runs and reviews the scan before the timer. Frontend should reveal available sections during the scan and preserve the reading position. |
| 3 | Scroll to Permission history. Four rows used “In use since” for entries with zero stop timestamps, all older than a week. The oldest was 827 days. | `public/intel.js` permission renderer | Frontend should label them “No stop recorded” and reserve current-use language for a live detector. The registry value and timestamp are already available. |
| 4 | Scroll to “Phones home on its own” and “Extensions that can read every site.” These labels overstate the evidence, which consists of metadata and permission scope. | `public/intel.js` scan cards | Frontend should use “Flagged startup entries, tasks and services” and “Extensions with broad host access.” Keep the reason and evidence type visible. |
| 5 | Switch views quickly during the hook. Chrome logged `AbortError: Transition was skipped. New ViewTransition started`. | `public/common.js` view transition | Frontend should handle a superseded transition and verify rapid switches settle on the final tab. |
| 6 | Open Globe at 1920×1080 and wait only for canvas. A prewarmed canvas was present while there were zero controls, even though the API had 53 geolocated destinations. | `public/globe.js` prewarm and initial render | Frontend should use available filters or a rendered country list as the readiness signal. A country control is a reliable route to details when individual markers are difficult to select. |
| 7 | Read the provisional scan while the background walk runs. The first uncompressed response was 757,152 bytes and the frontend continued polling it. “Scan complete” appeared beside “still running.” | `server.js`, `lib/scan-response.js`, `public/intel.js` | Backend sends a cached gzip representation when accepted and retains the no-store header. Frontend should label the first result “Scan results ready” and the app walk “Still measuring” until completion. |
| 8 | Compare the on-screen browser-match summary and “both send data” Spotlight copy to their sources. The records support prior public tracker associations and attributed endpoints. | `public/intel.js`, `public/computer.js`, `lib/report.js` | Backend report now identifies public matches and distinguishes local endpoints, listeners and inferred associations. Frontend should use “public tracker matches” and “endpoints attributed to the same company.” |
| 9 | In the accelerated 1920×1080 retest, attempt the block preview while the scan continuation is active. The request did not produce the plan within the harness's 5.5 s plan wait, although both paced rehearsals succeeded. No test rule remained afterwards. | `public/intel.js` policy fetch timeout, `lib/blocker/programs.js` executable resolver | The script now has a bounded fallback. Frontend and blocking lanes should expose the timeout and measure executable lookup time under concurrent scan load. The observed timeout alone does not identify which stage stalled. |
| 10 | In a follow-up scan during policy testing, the combined autorun collector exhausted its retry budget. The first result took 46.594 s, warned “Could not read autoruns,” and showed zero rows across all three sources. | `scripts/scan-windows.ps1`, `lib/scan/windows.js`, `lib/scan/worker.js` | Backend isolates startup entries, scheduled tasks and services with independent timeouts and warnings. A slow source can no longer discard completed results from the others. |

## Targeted retest

At 1920×1080, permission rows became available in the API after **4.822 s**, while status was running. The completed first result arrived at **20.391 s**. The same local scan response transferred **759,111 bytes** as identity and **83,607 bytes** as gzip, an **89.0%** reduction. Both responses returned `Cache-Control: no-store`, and the compression test verifies identical decoded JSON.

Waiting for Globe controls as well as the canvas exposed eight app filters and three country controls. A country expansion displayed three detail rows, and clicking an estimate marker opened the attribution panel. The targeted action sequence took **1.18 s**. The paced main rehearsals are the timing evidence for the dry-run slot.

The accelerated Chrome run's 65-second post-Globe wait expired with the background walk active. A separate local run allowed the walk to finish and observed cache completion after **103.603 s**. A direct local policy request during that walk returned a three-command dry-run preview in **2.292 s** and the test rule was removed. The intermittent Chrome timeout remains a handoff item.

After splitting autorun sources, a foreground sample returned 10 startup entries and 200 tasks in **20.866 s** despite a service-query warning. That background walk finished in **87.807 s**. In the same run a direct preview took **7.836 s** and returned a decision with zero commands. The test removed its rule. The phone/blocking lane should inspect executable lookup and distinguish a local decision from a runnable plan.

After replacing the service inventory's CIM query with Service Control Manager status and selected registry metadata, the final foreground scan returned in **20.402 s** with **10 startup entries, 200 tasks, seven matched services, and zero collector warnings**. Service classification uses the name, display name and stored description, which can be an indirect resource reference.

**Most Adventurous.** The permission timestamps and the sourced Tim Hortons dossier form the strongest discovery sequence. The Globe and block preview give the judge a way to inspect an observation and preview a response.

**Best Use of Auth0.** The local rehearsal did not establish hosted approval or revocation. Fixture coverage is useful engineering evidence. A live end-to-end hosted result is the remaining sponsor evidence.

## Backend fixes

- `b08b002` caches compressed scan responses.
- `270595f` qualifies the Markdown report's tracker and link evidence.
- `fa26414` publishes completed scan sections during the foreground scan.
- `f972c38` and `864ddb4` revise the judged script, Devpost claims and timing fallbacks.
- `7aa600d` isolates autorun collectors so slow task enumeration cannot erase startup and service results.
- `effbc13` replaces the timing-out service inventory with read-only Service Control Manager and registry metadata.
