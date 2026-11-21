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

function sessionKey({ app, start }) { return JSON.stringify([app, start]); }

function timeInUse(sessions, dayStart, now) {
  const ordered = sessions.slice().sort((a, b) => a.start - b.start);
  let total = 0;
  let through = dayStart;
  for (const session of ordered) {
    const stop = Math.min(session.stop, now);
    total += Math.max(0, stop - Math.max(session.start, through));
    through = Math.max(through, stop);
  }
  return total;
}

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
    execFile('reg', ['query', `${BASE}\\${device}`, '/s'], { windowsHide: true, timeout: 5000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      const entries = [];
      let current = null;
      for (const line of stdout.split(/\r?\n/)) {
        if (line.startsWith('HKEY_')) {
          const name = line.split('\\').pop();
          current = (name === device || name === 'NonPackaged') ? null : { key: name, start: 0, stop: null };
          if (current) entries.push(current);
          continue;
        }
        const m = line.match(/^\s+(LastUsedTimeStart|LastUsedTimeStop)\s+REG_QWORD\s+(0x[0-9a-fA-F]+)/);
        if (m && current) current[m[1] === 'LastUsedTimeStart' ? 'start' : 'stop'] = filetimeToMs(m[2]);
      }
      resolve(entries.filter((e) => e.start > 0 && (e.stop === 0 || e.stop >= e.start)));
    });
  });
}

class DeviceWatcher {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.active = { mic: new Map(), camera: new Map() }; // appId -> registry entry
    this.history = { mic: [], camera: [] };              // [{ app, start, stop }]
    this.lastUsedByApp = { mic: [], camera: [] };
    this.initialized = new Set();
    this.dirty = false;
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
      for (const kind of Object.keys(DEVICES)) {
        if (!Array.isArray(saved?.[kind])) continue;
        this.history[kind] = saved[kind].filter((s) =>
          typeof s?.app === 'string' && Number.isFinite(s.start) && s.start > 0 && Number.isFinite(s.stop) && s.stop >= s.start);
      }
    } catch { /* first run */ }
  }

  async save() {
    const pending = `${USAGE_FILE}.${process.pid}.tmp`;
    await fs.promises.mkdir(path.dirname(USAGE_FILE), { recursive: true });
    await fs.promises.writeFile(pending, JSON.stringify(this.history));
    await fs.promises.rename(pending, USAGE_FILE);
    this.dirty = false;
  }

  async poll() {
    const inputs = await Promise.all(Object.entries(DEVICES).map(async ([kind, name]) => [kind, await queryRegistry(name)]));
    const now = Date.now();
    for (const [kind, rows] of inputs) {
      if (rows === null) continue;
      const entries = rows.map(({ key, start, stop }) => ({ ...appNameFromKey(key), start, stop }));
      entries.sort((a, b) => b.start - a.start);
      this.lastUsedByApp[kind] = entries.slice(0, 15);

      const previous = this.active[kind];
      const next = new Map();
      const sessions = new Map(this.history[kind].map((session) => [sessionKey(session), session]));
      for (const entry of entries) {
        const { id, label, start, stop } = entry;
        if (stop === 0) {
          if (start <= now && now - start < STALE_MS && !next.has(id)) next.set(id, entry);
          continue;
        }
        const key = sessionKey({ app: label, start });
        if (sessions.get(key)?.stop !== stop) {
          sessions.set(key, { app: label, start, stop });
          this.dirty = true;
        }
      }
      this.history[kind] = [...sessions.values()].sort((a, b) => a.stop - b.stop).slice(-500);
      this.active[kind] = next;

      for (const [id, { label, start }] of previous) {
        if (next.get(id)?.start === start) continue;
        const recorded = sessions.get(sessionKey({ app: label, start }));
        const stop = recorded?.stop ?? next.get(id)?.start ?? now;
        this.onEvent({ type: `${kind}-off`, app: label, at: stop, durationMs: Math.max(0, stop - start) });
      }
      if (this.initialized.has(kind)) {
        for (const [id, { label, start }] of next) {
          if (previous.get(id)?.start === start) continue;
          this.onEvent({ type: `${kind}-on`, app: label, at: start });
        }
      }
      this.initialized.add(kind);
    }
    if (this.dirty) await this.save();
  }

  snapshot() {
    const now = Date.now();
    const dayStart = new Date(now).setHours(0, 0, 0, 0);
    const out = {};
    for (const kind of Object.keys(DEVICES)) {
      const activeList = [...this.active[kind].values()].map(({ id, label, start }) => ({ id, app: label, since: start }));
      const today = [
        ...this.history[kind],
        ...activeList.map(({ since }) => ({ start: since, stop: now })),
      ].filter((s) => (s.stop > dayStart || s.start === dayStart) && s.start <= now);
      out[kind] = {
        active: activeList.length > 0,
        apps: activeList,
        sessionsToday: today.length,
        totalMsToday: timeInUse(today, dayStart, now),
        recentSessions: this.history[kind].slice(-20).reverse(),
        lastUsedByApp: this.lastUsedByApp[kind],
      };
    }
    return out;
  }
}

module.exports = { DeviceWatcher };
