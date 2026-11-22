const retries = new Set(['epic-games', 'youtube', 'flo', 'goodrx', 'betterhelp', 'Kochava']);
module.exports = require('./incidents-01').filter((entry) => retries.has(entry.id)).map((entry) => ({
  ...entry, url: entry.url.replace('www.ftc.gov', 'search.ftc.gov'),
  // A case page may be updated later. Retain the sourced incident year without assigning a page date.
  date: null,
}));
