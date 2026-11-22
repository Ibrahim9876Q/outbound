const fs = require('node:fs');
const path = require('node:path');
const { localDate } = require('./report');
const { timeInUse } = require('./devices');
const { key } = require('./dossier');
const { isRecord, readLocalJson } = require('./local-json');

function cutoff(now) {
  const date = new Date(now);
  date.setDate(date.getDate() - 29);
  return localDate(date.getTime());
}

const union = (a, b) => [...new Set([...a, ...b])];
function empty(name) {
  return { name, companies: [], trackers: [], countries: [], backgroundMs: 0, micSeconds: 0, cameraSeconds: 0 };
}

function validHistory(value) {
  return isRecord(value?.days) && Object.values(value.days).every((rows) => isRecord(rows) &&
    Object.values(rows).every((row) => typeof row?.name === 'string' &&
      ['companies', 'trackers', 'countries'].every((field) => Array.isArray(row[field])) &&
      ['backgroundMs', 'micSeconds', 'cameraSeconds'].every((field) => Number.isFinite(row[field]))));
}

class DailyHistory {
  constructor(file = path.join(__dirname, '..', 'data', 'history.json')) {
    this.file = file;
    this.base = new Map();
    const saved = readLocalJson(file, 'local daily history', validHistory, (warning) => {
      this.warning = warning;
      console.warn(warning);
    });
    this.days = saved?.days ?? {};
    this.prune(Date.now());
  }

  prune(now) {
    const oldest = cutoff(now);
    for (const day of Object.keys(this.days)) {
      if (day < oldest || day > localDate(now)) {
        delete this.days[day];
        this.dirty = true;
      }
    }
    for (const date of this.base.keys()) if (date < oldest) this.base.delete(date);
  }

  capture(now, networkApps, sessions) {
    const day = localDate(now);
    this.prune(now);
    const rows = this.days[day] ??= Object.create(null);
    if (!this.base.has(day)) this.base.set(day, new Map(Object.entries(rows).map(([id, row]) => [id, row.backgroundMs])));
    const backgroundBase = this.base.get(day);
    for (const [id, app] of networkApps) {
      const row = Object.hasOwn(rows, id) ? rows[id] : (rows[id] = empty(app.name));
      row.name = app.name;
      row.companies = union(row.companies, app.companies);
      row.countries = union(row.countries, app.countries);
      row.trackers = union(row.trackers, [...app.trackers.values()].flatMap((values) => [...values]));
      row.backgroundMs = (backgroundBase.get(id) ?? 0) + (app.background.milliseconds ?? 0);
    }
    const midnight = new Date(now).setHours(0, 0, 0, 0);
    const aliases = new Map(Object.entries(rows).flatMap(([id, row]) => [[key(id), id], [key(row.name), id]]));
    for (const kind of ['mic', 'camera']) {
      const grouped = new Map();
      for (const session of sessions[kind]) {
        if (session.stop <= midnight || session.start > now) continue;
        const id = aliases.get(key(session.id || session.app)) ?? session.id ?? `${key(session.app)}.exe`;
        if (!Object.hasOwn(rows, id)) rows[id] = empty(session.app);
        if (!grouped.has(id)) grouped.set(id, []);
        grouped.get(id).push(session);
      }
      for (const [id, list] of grouped) {
        const field = `${kind}Seconds`;
        rows[id][field] = Math.max(rows[id][field], Math.floor(timeInUse(list, midnight, now) / 1000));
      }
    }
    this.dirty = true;
  }

  snapshot(now = Date.now()) {
    this.prune(now);
    return { ...(this.warning ? { warning: this.warning } : {}), days: Object.keys(this.days).sort().map((date) => ({
      date,
      apps: Object.entries(this.days[date]).map(([id, row]) => ({
        id, name: row.name, companies: row.companies.length, trackers: row.trackers.length, countries: row.countries.length,
        backgroundMinutes: Math.round(row.backgroundMs / 600) / 100, micSeconds: row.micSeconds, cameraSeconds: row.cameraSeconds,
      })),
    })) };
  }

  save() {
    if (!this.dirty) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ days: this.days }));
    fs.renameSync(temp, this.file);
    this.dirty = false;
    this.warning = null;
  }
}

module.exports = { DailyHistory, cutoff };
