# Outbound demo QA

Chrome on Windows, loopback port 4318, local provider and dry-run enforcer. The rehearsals used real connection samples and a completed local scan with 629 permission rows. Chrome made zero external page requests. The captures are local files outside the repository.

## Rehearsal

| Check | 1920×1080 | 1366×768 |
| --- | --- | --- |
| Computer app and attributed endpoint | Opened | Opened |
| Stored Data summary and permission timestamp | Opened | Opened |
| Tim Hortons 2022 investigation and regulator citation | Opened | Opened |
| Dry-run preview and removal | Firewall command returned in 4.17 s. Rule removed. | The full walkthrough displayed a decision without a command and removed the rule. A focused retest returned a firewall command in 2.09 s and removed its rule. |
| App-filtered globe and pinned attribution | Opened | Opened |
| Dashboard overflow, reload, rapid switching, shortcuts 1–6 | Passed | Passed |

Chrome recorded zero console errors in the final two-size walkthrough. Escape closed App X-ray and pinned Globe details. The active tab showed a visible focus outline when reached by a shortcut. Emulated reduced motion stopped Computer packets and paused Globe rotation.

The final cold page load reached the first populated Computer app in 1.51 s and a mapped Globe with controls in 2.74 s. The browser used a fresh profile. The pre-run scan results were restored from the completed real scan for the rehearsal.

## Frame cadence at 1920×1080

Measured with 2.4-second `requestAnimationFrame` samples in headless Chrome. Computer was unselected with wires enabled. Globe was unfiltered. Stored Data results remained available.

| View | Peak retained apps during sample | FPS | 95th percentile frame interval | Frames at or above 34 ms |
| --- | ---: | ---: | ---: | ---: |
| Computer | 12 | 83 | 22 ms | 0 |
| Globe | 12 | 87 | 11 ms | 0 |

The 80-app run remains unverified. The captured workload contained 12 retained apps, and the frame rates above apply to that workload and browser configuration.

## Local screenshots

Directory `%TEMP%\outbound-xray8-wEurIW\screenshots`

- At 1920×1080, `computer-1920x1080.png`, `permissions-1920x1080.png`, `dossier-1920x1080.png`, `rules-1920x1080.png`, and `globe-1920x1080.png`
- At 1366×768, `computer-1366x768.png`, `permissions-1366x768.png`, `dossier-1366x768.png`, `rules-1366x768.png`, and `globe-1366x768.png`
- The successful compact command preview is at `%TEMP%\outbound-xray8-CdGPGg\screenshots\rules-command-1366x768.png`.

All 40 tests and the smoke check passed.

## xray9 replay verification

The 80-app measurements remain blocked on integration commit `7c867fa`. Its tracked files and replay references contain no test-only 80-app dashboard replay fixture. The earlier backend destination-retention replay used a different workload. The live frame measurements above remain the verified results.

## xray9 browser and gallery verification

- Chrome and Edge each verified the 6 px scrollbar, dark grey thumb, and transparent track on six containers spanning the Dossier, Computer feed, Stored Data, and Globe.
- Chrome completed three reloads on each of the seven dashboard views on port 4318. All 21 reloads produced zero console errors and zero external page requests. Edge completed the scrollbar check. Its supplemental reload run timed out.
- A real local dry-run rule was created and removed in Chrome. A DOM observer counted one update to the empty list, and the policy API confirmed zero remaining rules after refresh.
- The seven public-facing captures are in `notes/gallery/` at 1920×1080. Stored Data shows the real aggregate summary, with browser profiles and domain rows excluded. Individual connection and device history details were omitted from the gallery.

## xray10 labeled replay

Ran `npm run fixture` on loopback port 4318 with a gitignored, previously collected local recording. The API header and dashboard both showed `FIXTURE DATA`. The sample contained 80 distinct app records and 24 retained remote endpoints.

At 1920×1080, headless Chrome sampled three consecutive three-second `requestAnimationFrame` windows per view.

| View | FPS by window | 95th percentile frame interval | Frame intervals above 33 ms |
| --- | --- | --- | ---: |
| Computer | 90, 90, 90 | 11, 11, 11 ms | 0 |
| Globe | 90, 85, 90 | 11, 22, 11 ms | 0 |

Every window exceeded 50 fps. These figures describe frame callback cadence on this machine and the recorded endpoint load. No performance change was needed for this replay. The fixture remains opt-in.

## xray10 live browser QA

Turned off replay and used an isolated loopback server with a completed local scan. With browser caching disabled, each of the seven views passed a cold navigation and three reloads in Chrome and Edge at both 1366×768 and 1920×1080. That is 28 cold navigations and 84 reloads. The runs recorded zero console errors, horizontal overflow checks that failed, or external page requests.

Chrome matched all 20 rendered excerpts to their catalog text, source title, date, and link. An unquoted record retained its regular incident layout. All 51 tests and the live smoke check passed.
