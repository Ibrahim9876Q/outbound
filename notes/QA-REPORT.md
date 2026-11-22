# Outbound desktop QA

## 1. Browser walkthrough

Tested desktop commit `d0c4e4a` on Windows with headless Chromium and SwiftShader WebGL. The desktop ran from this worktree with `PORT=4321` bound to `127.0.0.1`. The app consumed real Windows observations and owned loopback SSE connections. I started and stopped only my test processes. I skipped the Phone view and gateway. The first desktop run had the built-in background Phone status poll enabled. I identified it in `server.js:28` and blocked those requests in the supplemental run with a process-local fetch wrapper. Browser requests to the reserved loopback ports were blocked in the first run.

| Check | 1280×800 | 1920×1080 |
| --- | --- | --- |
| Computer and live app icons | First app in 0.78 s, seven icons, 44 live connections | First app in 1.17 s, seven icons, 46 live connections |
| App details and wire toggles | Clicking an app populated its details. Each of the three checkboxes toggled off and on. | Same. This verifies control state. The presence of every wire type depends on the observed connections. |
| Spotlight and contrast | Spotlight displayed a live app summary and stopped from the same button. High contrast switched on by button and off by H. | Same |
| Globe | WebGL canvas after 2.89 s. Eight app filters, one country, and a populated Data trail. | WebGL canvas after 1.75 s. Eight app filters, one country, and a populated Data trail. |
| Globe controls | Selected and cleared an app filter, expanded a country, toggled rotation and HQ links, opened Map legend, and exercised wheel zoom. Clicked a visible estimate marker and closed its detail on the supplemental pass. | Same |
| Layout and reload | Document width matched viewport. Reload restored live app content. Top bar used 92 px and laptop base ended at y=760. | Document width matched viewport. Reload restored live app content. Top bar used 64 px and laptop base ended at y=1031. |

With the page left open, stopping the test server showed **Reconnecting…**. Restarting on 4321 restored the **Live** badge in about 6.35 s, initially with zero connections. Chromium logged `ERR_CONNECTION_RESET` and `ERR_CONNECTION_REFUSED` during the intentional outage. The supplemental steady-state run recorded no console warnings or errors. The software-rendered globe delivered about 11 animation frames/s in a 1.2-second sample at each resolution. This measures the headless test environment and gives no hardware-GPU result.

The sample had no flagged trackers in the supplemental run. The app-detail keyboard focus attempt failed at both sizes. I exercised the HQ toggle and legend state, but did not visually verify every individual HQ arc. I did not activate the physical mic or camera.
