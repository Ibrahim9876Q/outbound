// Watches when apps use the microphone and camera.
// Windows records this in the registry for its privacy indicator: each app gets
// LastUsedTimeStart / LastUsedTimeStop, and Stop is 0 while the app is still using the device.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore';
const DEVICES = { mic: 'microphone', camera: 'webcam' };
const USAGE_FILE = path.join(__dirname, '..', 'data', 'usage.json');
const STALE_MS = 12 * 60 * 60 * 1000; // ignore "still running" entries older than 12h (crashed apps)

function filetimeToMs(hex) {
  const v = BigInt(hex);
  if (v === 0n) return 0;
  return Number(v / 10000n) - 11644473600000;
}

function appNameFromKey(key) {
  // Packaged apps: "5319275A.WhatsAppDesktop_cv1g1gvanyjgm"
  // Desktop apps:  "C:#Program Files#Google#Chrome#Application#chrome.exe"
  if (key.includes('#')) {
    const file = key.split('#').pop();
    return { id: file.toLowerCase(), label: file.replace(/\.exe$/i, ''), path: key.replace(/#/g, '\\') };
  }
  const noPublisher = key.split('_')[0];
  const label = noPublisher.split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2');
  return { id: key.toLowerCase(), label, path: null };
}

function queryRegistry(device) {
  return new Promise((resolve) => {
    execFile('reg', ['query', `${BASE}\\${device}`, '/s'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return resolve([]);
      const entries = [];
      let current = null;
      for (const line of stdout.split(/\r?\n/)) {
        if (line.startsWith('HKEY_')) {
          const name = line.split('\\').pop();
          current = (name === device || name === 'NonPackaged') ? null : { key: name, start: 0, stop: 0 };
          if (current) entries.push(current);
          continue;
        }
        const m = line.match(/^\s+(LastUsedTimeStart|LastUsedTimeStop)\s+REG_QWORD\s+(0x[0-9a-fA-F]+)/);
        if (m && current) current[m[1] === 'LastUsedTimeStart' ? 'start' : 'stop'] = filetimeToMs(m[2]);
      }
      resolve(entries.filter((e) => e.start > 0));
    });
  });
}

class DeviceWatcher {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.active = { mic: new Map(), camera: new Map() }; // appId -> { label, since }
    this.history = { mic: [], camera: [] };              // [{ app, start, stop }]
    this.lastUsedByApp = { mic: [], camera: [] };
    this.firstPoll = true;
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
      this.history.mic = saved.mic || [];
      this.history.camera = saved.camera || [];
    } catch { /* first run */ }
  }

  save() {
    fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
    fs.writeFile(USAGE_FILE, JSON.stringify(this.history), () => {});
  }

  async poll() {
    const now = Date.now();
    for (const [kind, regName] of Object.entries(DEVICES)) {
      const entries = await queryRegistry(regName);
      const seenActive = new Set();

      this.lastUsedByApp[kind] = entries
        .map((e) => ({ ...appNameFromKey(e.key), start: e.start, stop: e.stop }))
        .sort((a, b) => b.start - a.start)
        .slice(0, 15);

      for (const e of entries) {
        const app = appNameFromKey(e.key);
        const inUse = e.stop === 0 && now - e.start < STALE_MS;
        if (!inUse) continue;
        seenActive.add(app.id);
        if (!this.active[kind].has(app.id)) {
          this.active[kind].set(app.id, { label: app.label, since: e.start });
          if (!this.firstPoll) this.onEvent({ type: `${kind}-on`, app: app.label, at: now });
        }
      }

      for (const [id, info] of this.active[kind]) {
        if (seenActive.has(id)) continue;
        this.active[kind].delete(id);
        this.history[kind].push({ app: info.label, start: info.since, stop: now });
        this.history[kind] = this.history[kind].slice(-500);
        this.save();
        this.onEvent({ type: `${kind}-off`, app: info.label, at: now, durationMs: now - info.since });
      }
    }
    this.firstPoll = false;
  }

  snapshot() {
    const now = Date.now();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const out = {};
    for (const kind of Object.keys(DEVICES)) {
      const today = this.history[kind].filter((s) => s.start >= dayStart.getTime());
      const activeList = [...this.active[kind].values()].map((a) => ({ app: a.label, since: a.since }));
      const activeMs = activeList.reduce((sum, a) => sum + (now - Math.max(a.since, dayStart.getTime())), 0);
      out[kind] = {
        active: activeList.length > 0,
        apps: activeList,
        sessionsToday: today.length + activeList.length,
        totalMsToday: today.reduce((sum, s) => sum + (s.stop - s.start), 0) + activeMs,
        recentSessions: this.history[kind].slice(-20).reverse(),
        lastUsedByApp: this.lastUsedByApp[kind],
      };
    }
    return out;
  }
}

module.exports = { DeviceWatcher };
