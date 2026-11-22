// Tracks microphone and camera sessions from the Windows capture-session detectors.
const { spawn } = require('child_process');
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

function readDetector(detector, script) {
  if (detector.child && Date.now() - detector.lastFrame > DETECTOR_TIMEOUT_MS) {
    detector.child.kill();
  }
  if (!detector.child && Date.now() >= detector.retryAt) {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(__dirname, '..', 'scripts', script),
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    detector.child = child;
    detector.lastFrame = Date.now();
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const frame = JSON.parse(line);
        if (!Array.isArray(frame.sessions)) return;
        detector.lastFrame = Date.now();
        detector.pending = frame.sessions;
      } catch { /* wait for the next valid snapshot */ }
    });
    child.on('error', (error) => console.error(`${script}: ${error.code || error.message}`));
    child.on('close', (code) => {
      if (code) console.error(`${script} exited with code ${code}`);
      detector.child = null;
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
    this.detectors = Object.fromEntries(Object.keys(DEVICES).map((kind) => [kind, { child: null, pending: null, retryAt: 0 }]));
    this.lastObserved = { mic: new Map(), camera: new Map() };
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
    for (const detector of Object.values(this.detectors)) detector.child?.kill();
  }

  async poll() {
    const now = Date.now();
    for (const [kind, script] of Object.entries(DEVICES)) {
      const rows = readDetector(this.detectors[kind], script);
      if (rows === null) continue;
      const previous = this.active[kind];
      const next = new Map();
      const observed = this.lastObserved[kind];
      for (const row of rows) {
        if (row?.active !== true || typeof row.name !== 'string' || !row.name.trim()) continue;
        const label = row.name.trim().replace(/\.exe$/i, '');
        const id = `${label.toLowerCase()}.exe`;
        if (next.has(id)) continue;
        next.set(id, { id, label: previous.get(id)?.label ?? label, path: row.path || null, start: previous.get(id)?.start ?? now, stop: 0 });
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
      this.lastUsedByApp[kind] = [...observed.values()].sort((a, b) => b.start - a.start).slice(0, 15);
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
