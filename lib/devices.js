// Tracks microphone and camera sessions from the Windows capture-session detectors.
const { execFile, spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const DEVICES = { mic: 'audio-sessions.ps1', camera: 'camera-sessions.ps1' };
const USAGE_FILE = path.join(__dirname, '..', 'data', 'usage.json');
const DETECTOR_TIMEOUT_MS = 8000;

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

const BASE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore';
const REGISTRY = { mic: 'microphone', camera: 'webcam' };

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

function readDetector(detector, script) {
  if (process.platform !== 'win32') return null;
  if (detector.child && Date.now() - detector.lastFrame > DETECTOR_TIMEOUT_MS) {
    detector.live = false;
    detector.child.kill();
  }
  if (!detector.child && Date.now() >= detector.retryAt) {
    let child;
    try {
      child = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
        path.join(__dirname, '..', 'scripts', script),
      ], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, OUTBOUND_DETECTOR_PARENT: String(process.pid) },
      });
    } catch (error) {
      console.error(`${script}: ${error.code || error.message}`);
      detector.retryAt = Date.now() + 2000;
      return null;
    }
    detector.child = child;
    detector.lastFrame = Date.now();
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const frame = JSON.parse(line);
        if (!Array.isArray(frame.sessions)) return;
        detector.lastFrame = Date.now();
        detector.live = true;
        detector.pending = frame.sessions;
      } catch { /* wait for the next valid snapshot */ }
    });
    child.on('error', (error) => console.error(`${script}: ${error.code || error.message}`));
    child.on('close', (code) => {
      if (code) console.error(`${script} exited with code ${code}`);
      detector.child = null;
      detector.live = false;
      detector.pending = null;
      detector.retryAt = Date.now() + 2000;
    });
  }
  const rows = detector.pending;
  detector.pending = null;
  return rows;
}

class DeviceWatcher {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.active = { mic: new Map(), camera: new Map() }; // appId -> observed session
    this.history = { mic: [], camera: [] };              // [{ app, start, stop }]
    this.lastUsedByApp = { mic: [], camera: [] };
    this.detectors = Object.fromEntries(Object.keys(DEVICES).map((kind) =>
      [kind, { child: null, pending: null, retryAt: 0, live: false }]));
    this.lastObserved = { mic: new Map(), camera: new Map() };
    this.registry = { mic: null, camera: null };
    this.registryRefreshAt = 0;
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

  close() {
    this.closed = true;
    for (const detector of Object.values(this.detectors)) detector.child?.kill();
  }

  async poll() {
    if (this.closed) return;
    if (process.platform === 'win32' && Date.now() >= this.registryRefreshAt) {
      const allLive = Object.values(this.detectors).every((detector) => detector.live);
      this.registryRefreshAt = Date.now() + (allLive ? 10000 : 750);
      await Promise.all(Object.entries(REGISTRY).map(async ([kind, name]) => {
        const rows = await queryRegistry(name);
        if (rows) this.registry[kind] = rows.map(({ key, start, stop }) => ({ ...appNameFromKey(key), start, stop }));
      }));
    }
    if (this.closed) return;
    const now = Date.now();
    for (const [kind, script] of Object.entries(DEVICES)) {
      const detector = this.detectors[kind];
      const rows = readDetector(detector, script);
      const registry = this.registry[kind];
      if (rows === null && (detector.live || registry === null)) continue;
      const previous = this.active[kind];
      const next = new Map();
      const observed = this.lastObserved[kind];
      for (const row of rows ?? []) {
        if (row?.active !== true || typeof row.name !== 'string' || !row.name.trim()) continue;
        const label = row.name.trim().replace(/\.exe$/i, '');
        const id = `${label.toLowerCase()}.exe`;
        if (next.has(id)) continue;
        next.set(id, { id, label: previous.get(id)?.label ?? label, path: row.path || null, start: previous.get(id)?.start ?? now, stop: 0 });
      }
      if (rows === null) {
        for (const entry of registry) {
          if (entry.stop === 0 && entry.start <= now && now - entry.start < 12 * 60 * 60 * 1000) {
            const current = next.get(entry.id);
            if (!current || current.start < entry.start) next.set(entry.id, previous.get(entry.id) ?? entry);
          }
        }
      }
      this.active[kind] = next;
      for (const [id, session] of previous) {
        if (next.has(id)) continue;
        observed.set(id, { ...session, stop: now });
        this.history[kind].push({ app: session.label, start: session.start, stop: now });
        this.dirty = true;
        this.onEvent({ type: `${kind}-off`, app: session.label, at: now, durationMs: now - session.start });
      }
      for (const [id, session] of next) {
        observed.set(id, session);
        if (!previous.has(id)) this.onEvent({ type: `${kind}-on`, app: session.label, at: session.start });
      }
      this.history[kind] = this.history[kind].slice(-500);
    }
    for (const kind of Object.keys(DEVICES)) {
      const merged = new Map();
      for (const entry of this.registry[kind] ?? []) {
        if ((merged.get(entry.id)?.start ?? 0) < entry.start) merged.set(entry.id, entry);
      }
      for (const entry of this.lastObserved[kind].values()) merged.set(entry.id, entry);
      this.lastUsedByApp[kind] = [...merged.values()].sort((a, b) => b.start - a.start).slice(0, 15);
    }
    if (this.dirty) await this.save();
  }

  snapshot() {
    const now = Date.now();
    const dayStart = new Date(now).setHours(0, 0, 0, 0);
    const out = { source: Object.values(this.detectors).every((detector) => detector.live) ? 'live' : 'registry' };
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
