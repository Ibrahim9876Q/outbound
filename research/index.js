function buildIndex(apps) {
  function lookups(field, normalize) {
    const entries = new Map();
    for (const app of apps) {
      for (const raw of app[field]) {
        const key = normalize(raw);
        if (!key) continue;
        if (!entries.has(key)) entries.set(key, new Set());
        entries.get(key).add(app.id);
      }
    }
    return Object.fromEntries([...entries.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([key, ids]) => [key, [...ids].sort()]));
  }
  return {
    exe: lookups('processNames', (name) => name.trim().toLowerCase()),
    domain: lookups('domains', (name) => name.trim().toLowerCase().replace(/\.$/, '')),
  };
}

module.exports = { buildIndex };
