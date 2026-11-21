# Outbound: build prompt with a self-improving agent loop

> Paste everything below this line into your coding agent (Claude Code or similar), started inside the `outbound` folder.

---

## 1. Your role

You are the lead engineer and designer for **Outbound**, a hackathon project being built at **Hack Western 13**. You work autonomously in a loop: plan, build, run, verify, critique, improve. You keep going until the stop conditions in section 10 are met. You are judged on what actually runs on screen in a 3-minute live demo, not on plans.

## 2. Mission

Outbound is a Windows desktop dashboard (a local web app at `http://localhost:4317`) that makes the invisible visible:

1. **Where your apps send your data.** Every app with an internet connection, which company owns each server it talks to, and which country that server is in.
2. **When apps use your microphone and camera,** and how often.
3. **Which apps talk to each other,** either directly on your PC or by sending data to the same company.

It's inspired by CBC Marketplace's November 2026 investigation, which found popular apps like Tim Hortons sending data to outside companies as soon as they open. The hackathon theme is "Discover the unknown." The target prize is **Organizers' Choice: Most Adventurous** ("a hack that enables others to discover the unknown"), with **MLH Best Use of Auth0** as a second track later.

## 3. Hard constraints

- **Deadline:** coding stops and the Devpost submission is due **Sunday Nov 22, 2026, 9:00 AM EST**. Check the current time (`date`) at the start of every loop iteration. At **7:00 AM**, stop adding features and switch to polish, the demo script and the Devpost write-up. At **8:30 AM**, stop everything and report.
- **The demo is 3 minutes plus 1 minute of questions, with no slides.** Every feature must be visible and understandable within seconds.
- **All code must be written during the hackathon.** Open-source libraries are fine.
- **Windows only, for now.** The PC is Windows 11 with Node 24 and npm 11. Use Git Bash or PowerShell.

## 4. What already exists (read these files first)

```
outbound/
├─ package.json            deps: geoip-lite@2.0.3, globe.gl@2.46.2, @ip-location-db/asn@2.3.2026061719
├─ server.js               HTTP server on 127.0.0.1:4317. /events (Server-Sent Events, "state" every 1s + "event"),
│                          /api/state (JSON), /vendor/* (globe.gl + earth textures from node_modules), static /public
├─ lib/network.js          Polls `netstat -ano` every 2s + `tasklist`; maps PID -> app; builds:
│                            flows (app -> remote IP), local app<->app links (localhost TCP between two processes),
│                            "shared" links (two apps sending to the same company)
│                          Owner of each IP: DNS cache hostname (needs admin) > reverse DNS > offline ASN table
│                          Location: geoip-lite (offline). Real app icons extracted as base64 PNG.
├─ lib/devices.js          Polls the Windows privacy registry every 1s:
│                            HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\{microphone,webcam}
│                            LastUsedTimeStop == 0 means "in use right now". Emits mic-on/off, camera-on/off.
│                            Saves sessions to data/usage.json.
├─ lib/orgs.js             hostname -> company, tracker hostname list, tracker company list, friendly app names
├─ lib/asn.js              offline IP -> network owner (ASN) with binary search; ~0.6s load, ~150MB RAM
├─ scripts/procinfo.ps1    process id/name/path/description as JSON
├─ scripts/dnscache.ps1    Get-DnsClientCache as JSON (returns nothing unless run as admin)
├─ scripts/icons.ps1       exe paths on stdin -> { path: base64 png }
└─ public/index.html       DONE: layout for Computer view + Globe view. It references style.css, common.js,
                           computer.js and globe.js, which DO NOT EXIST YET. You write them.
```

Run it with `npm start`, or `node server.js` if there's no start script yet (add `"start": "node server.js"` to package.json).

### Data contract (`/api/state` and the SSE `state` event)

```js
{
  at, home: { lat, lng, label },               // home defaults to Western University, London ON
  dnsCacheAvailable: bool,
  apps: [{
    id: "chrome.exe", name: "Google Chrome", icon: "<base64 png>|null",
    activeConnections, companies, trackers, localPeers: ["discord.exe"],
    destinations: [{ ip, ports, active, sockets, firstSeen, lastSeen,
                     host, hostSource, org, network, asn, tracker, country, city, lat, lng }]
  }],
  links: [{ kind: "local", from, to, active, ports } | { kind: "shared", from, to, via: "Google", active }],
  devices: { mic: DEV, camera: DEV },          // DEV = { active, apps:[{app,since}], sessionsToday, totalMsToday,
                                               //         recentSessions:[{app,start,stop}], lastUsedByApp:[{id,label,path,start,stop}] }
  events: [{ type: "new-destination"|"new-link"|"mic-on"|"mic-off"|"camera-on"|"camera-off", app, org, host,
             country, tracker, from, to, at, durationMs }]
}
```

Device app ids look like `discord.exe` for desktop apps, or a packaged name like `5319275a.whatsappdesktop_cv1g1gvanyjgm`. Match them to network apps by exe id first, then by lowercase label.

## 5. Requirements, in priority order

### MUST, the Computer view (build this first, it's the hero of the demo)

1. **A drawn laptop** (HTML, CSS and SVG, no images): a lid with a bezel and screen, and a base with a keyboard and trackpad. It scales to fit the window with no horizontal scroll.
2. **Webcam on the top bezel:** a lens and an LED. When any app uses the camera, the LED glows, the lens pulses, the screen does a quick white "flash", and a label shows `● REC · <app name>`. When the camera turns off, it all returns to idle. Also show a camera key on the keyboard that mirrors this state.
3. **Mic key on the keyboard,** in the function row like a real laptop's mic-mute key. Idle shows a mic-with-slash icon, labelled muted. While an app uses the mic, it shows an unslashed mic, the key glows **orange** with a soft pulse and looks pressed, and a caption under the keyboard says which app is using it.
4. **How often:** the side panel shows mic and camera "times today", "time in use today", and a list of the most recent apps with relative times ("Discord · 3 min ago · 12m long").
5. **The screen is a desktop.** Apps with network activity, or currently using the mic or camera, appear as desktop icons using their real icons, with initials as a fallback. Icons keep stable positions between updates; don't let them jump around. Show badges for the number of companies and trackers (red). An app using the mic gets an orange ring; one using the camera gets a green ring.
6. **"The internet" strip** across the top of the screen shows chips for the top companies receiving data (owner name, flag emoji, red if it's a tracker), plus a "+N more" chip.
7. **Wires with data shooting along them:**
   - app → company: thin lines, with packets flying upward. Spawn rate scales with `sockets`.
   - app ↔ app (`kind: "local"`): bright curved wires, with packets shooting **both ways**. This is "app X firing data at app Y".
   - same company (`kind: "shared"`): dashed curve between the two apps, labelled `both → Google`.
   - Draw the packets with one `requestAnimationFrame` loop over an SVG layer. Don't restart animations on every 1s state update. Toggles above the laptop show or hide each wire type.
8. **Click an app:** the side panel lists its destinations (company, hostname if known, flag and city, tracker badge, live/closed dot, ports) and its local peers. Its wires highlight and the rest dim.
9. **Live activity feed:** readable sentences, newest first, such as "Spotify connected to Akamai (US)", "Microphone turned on by Discord", "Steam ↔ Steam Web Helper started talking directly". Show a small toast on the laptop screen for mic, camera and tracker events.
10. **Top bar stats:** apps online, companies, countries, trackers, plus mic, camera and live-connection pills.

### MUST, the Globe view

11. A globe.gl globe using the night Earth texture (`/vendor/earth-night.jpg`, `/vendor/night-sky.png`).
    - Arcs from `home` to every destination. Draw two animated arcs per destination: one going out (warm color), one coming back (cool color). The colors are per app, and trackers are red.
    - Points at each destination, sized by connection count. Hovering a point shows the company, city, country and app.
    - The side panel lists countries with counts and flags, plus app filter chips.
    - It auto-rotates slowly and stops rotating when the user interacts with it.

### SHOULD

12. A first-run hint if `dnsCacheAvailable` is false: "Run as administrator to see the exact website names apps ask for." Never ask for admin silently.
13. Performance: under 5% CPU while idle. Throttle DOM rebuilds by keying elements on id and updating them in place.
14. Readable at 1280×800 and on a projector. Dark theme, with a high-contrast mode.
15. A **"Demo spotlight"** button that cycles through the most interesting things on screen: the app with the most companies, any tracker, any local link.

### COULD (only after every MUST passes, ask the user before starting any of these)

16. **Phone view:** a phone sends its DNS lookups to Outbound through a WireGuard tunnel or a laptop hotspot. This needs a server; plan it, don't build it unasked.
17. **Auth0 "consent firewall":** trackers are blocked until the user approves them. Approvals are stored in Auth0 FGA with expiry times, and the approve/deny request goes out through Auth0 async authorization (CIBA). There's also a page that lists connected trackers and lets the user revoke them.
18. Gemini-written plain-English explanations of each company ("why is a coffee app talking to a fraud-detection firm?").

## 6. Design direction

- The look is cinematic but clean: a dark navy room, a glowing laptop, a subtle reflection under it. Use system font stacks (`"Segoe UI", system-ui`) and no web font downloads.
- Use one consistent color system with CSS variables:
  - mic `#ff8a1f` (orange)
  - camera `#3dffa0` (green)
  - outbound `#ffb347`
  - inbound `#4cc9ff`
  - local app↔app `#7cf9ff`
  - shared company `#c084fc`
  - tracker `#ff4d6d`
- Motion should be meaningful, not decorative: packets move, LEDs pulse, the camera flashes once. Respect `prefers-reduced-motion`.
- Everything a judge needs should be readable from 1.5 m away. Keep the important text 14px or larger.

## 7. The agentic loop (run this repeatedly)

Keep three memory files in the project root. Create them on your first iteration.

- `BACKLOG.md`: every requirement from section 5 as a checkbox, plus anything you discover. Keep it sorted by priority.
- `PROGRESS.md`: one entry per iteration: the time, what you changed, how you verified it, rubric scores, and what's next.
- `LESSONS.md`: what you learned about *how to work on this project*, such as tricks that worked, mistakes not to repeat, and commands that were slow or broken. **Read this file at the start of every iteration and follow it.** That's how you improve your own process, not just the code.

**Each iteration:**

1. **Orient.** Run `date`. Read `LESSONS.md`, the top of `BACKLOG.md` and the last `PROGRESS.md` entry. Check which time phase you're in (section 3).
2. **Choose.** Pick the single highest-value unfinished item, meaning whatever most improves the 3-minute demo. Break it down if it's bigger than about 45 minutes of work.
3. **Plan.** Write 2–5 lines in `PROGRESS.md`: the goal, which files change, and how you'll prove it works.
4. **Build.** Make the smallest change that achieves the goal. Match the existing code style, and keep functions small and named clearly.
5. **Run.** Restart the server in the background. Wait about 6 seconds. Confirm `curl -s localhost:4317/api/state` returns valid JSON with apps in it.
6. **Verify the behaviour, not just the code:**
   - Check the browser console: there must be no errors. Use a browser or preview tool if you have one; otherwise use `node` checks of the served files.
   - Take screenshots at 1280×800 and 1920×1080 if you can. Look at them critically, the way a judge would.
   - **Mic and camera checks.** **Ask the user before turning on their camera or microphone.** With permission, open the Windows Camera app (`start microsoft.windows.camera:`), confirm the bezel flash and the green state appear within 2 seconds, then close it and confirm the idle state returns. Do the same for the mic with any app that records audio.
   - **Network checks:** open a website, then confirm that a new destination appears with an owner name and a country.
   - **Performance:** watch the Node process's CPU for 10 seconds while idle.
7. **Critique.** Score each rubric item 1–5 (section 8) and write the scores in `PROGRESS.md`. For every score below 4, write the specific reason and the fix.
8. **Learn.** If something went wrong or was slow, add a one-line rule to `LESSONS.md`. If you found a bug, add a regression check to section 9 of your own working checklist in `PROGRESS.md`, and re-run all of those checks on every future iteration.
9. **Decide.** If the item meets its acceptance check and no rubric score dropped, tick it in `BACKLOG.md` and loop. If it got worse, revert or fix before moving on. **Never leave the app broken at the end of an iteration.**

Every 3 iterations, do a **step-back review**. Re-read section 5, look at the whole UI fresh, and re-rank `BACKLOG.md`. Ask yourself: "If the demo were in 10 minutes, what is the one thing I'd fix?" Do that next.

## 8. Rubric (score 1–5 every iteration)

| # | Criterion | 5 looks like |
|---|-----------|--------------|
| 1 | **Truthful** | Every number on screen comes from real data. Nothing faked or implied, like "bytes sent", that isn't measured. |
| 2 | **Works live** | Mic, camera and network changes show up within 2s. No console errors. Survives 10 minutes running. |
| 3 | **Instantly readable** | A stranger understands the screen in 5 seconds. Labels are in plain English. |
| 4 | **Wow factor** | The laptop, the camera flash, the orange mic key and the packet wires feel alive and polished. |
| 5 | **Demo-ready** | The 3-minute script in section 11 can be performed without touching code. |
| 6 | **Performance** | Smooth animation (around 60fps), under 5% CPU idle, no memory growth. |
| 7 | **Code quality** | Small, clear modules, consistent naming, no dead code, comments only where something isn't obvious. |

## 9. Guardrails (never break these)

- **Never fake data.** If you add a demo or simulation mode for rehearsing, it must be off by default, behind an explicit toggle, and labelled **DEMO DATA** on screen at all times.
- **Privacy:** never send the user's connection list, IPs, app names or usage data to any outside service. The server stays bound to `127.0.0.1`. All lookups (geo, ASN) stay offline. Reverse DNS through the system resolver is the only network lookup allowed.
- **Don't change system settings,** firewall rules, the registry (read-only), or permissions. Don't request admin rights without asking the user.
- **Don't install new dependencies without a reason.** Pin exact versions and run `npm audit` afterwards. Load browser libraries from `node_modules` through `/vendor`, not from a CDN.
- **Don't commit, push or publish unless the user asks.** No destructive commands (`rm -rf`, force operations) outside files you created.
- Be honest about limits in the UI's footnote. Outbound sees *who* apps connect to and for how long. It doesn't see *what* they send, because the contents are encrypted.
- If you're blocked on a decision that's genuinely the user's call, ask one short question and keep working on something else meanwhile.

## 10. Stop conditions

Stop the loop and write a final report when any one of these is true:

- Every **MUST** item is ticked, every rubric score is 4 or higher on two consecutive iterations, and the demo script runs cleanly.
- It's **8:30 AM EST, Sunday Nov 22.**
- Three iterations in a row produced no rubric improvement. Report what's blocking you.
- The user tells you to stop.

**The final report includes:** what works (with screenshots), what doesn't, known limits, the exact commands to run the app, and the files changed.

## 11. Final deliverables (start at 7:00 AM at the latest)

1. **`DEMO.md`: a 3-minute script.**
   - 0:00–0:30 the hook: "Last week CBC found the Tim Hortons app sends your data to an outside company the moment it opens. What is *your* laptop doing?"
   - 0:30–1:30 the Computer view live: open an app and watch new companies light up and the wires fire.
   - 1:30–2:15 the camera and mic: start a video call, and the bezel flashes and the mic key glows orange.
   - 2:15–2:50 the Globe view: "your data visited 9 countries in the last 10 minutes."
   - 2:50–3:00 what's next: the phone view and the Auth0 consent firewall.
   - Include a backup plan for when the venue Wi-Fi is slow.
2. **`DEVPOST.md`:** inspiration, what it does, how we built it, challenges, accomplishments, what we learned, and what's next. Mention the Windows privacy registry trick, the offline ASN and geo lookups, and why the server stays local.
3. **`README.md`:** setup in 3 commands, a screenshot, and the limitations.

## 12. Start now

1. Read every file listed in section 4.
2. Create `BACKLOG.md`, `PROGRESS.md` and `LESSONS.md`.
3. Begin iteration 1: write `public/style.css`, `public/common.js` (the SSE connection, shared helpers like the flag emoji, relative time and duration formatting, and the app-to-device matching) and `public/computer.js`. Get the laptop with the live mic key and camera on screen first, then the desktop icons, then the wires.
4. Loop.
