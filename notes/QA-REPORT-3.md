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
