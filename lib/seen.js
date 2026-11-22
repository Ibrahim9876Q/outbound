const fs = require('node:fs');
const path = require('node:path');
const { localDate } = require('./report');
const { readLocalJson } = require('./local-json');

class SeenCompanies {
  constructor(file = path.join(__dirname, '..', 'data', 'seen.json')) {
    this.file = file;
    this.entries = new Map();
    for (const entry of readLocalJson(file, 'local company history', Array.isArray) ?? []) {
      if (typeof entry?.name === 'string' && Number.isFinite(entry.at)) {
        this.entries.set(this.key(entry.name), entry);
      }
    }
  }

  key(name) { return name.trim().normalize('NFKC').toLowerCase(); }

  observe(name, at) {
    if (!name || name === 'Unknown owner') return false;
    const key = this.key(name);
    if (!key || this.entries.has(key)) return false;
    this.entries.set(key, { name, at });
    this.dirty = true;
    return true;
  }

  namesOn(day) {
    return [...this.entries.values()].filter(({ at }) => localDate(at) === day).map(({ name }) => name);
  }

  async save() {
    if (!this.dirty) return;
    const temp = `${this.file}.${process.pid}.tmp`;
    await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
    await fs.promises.writeFile(temp, JSON.stringify([...this.entries.values()]));
    await fs.promises.rename(temp, this.file);
    this.dirty = false;
  }
}

module.exports = { SeenCompanies };
