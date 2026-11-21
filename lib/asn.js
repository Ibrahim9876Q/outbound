// Offline IP -> network owner lookup, using the ip-location-db ASN tables (no web requests).
const fs = require('fs');
const path = require('path');

const DIR = path.join(path.dirname(require.resolve('@ip-location-db/asn/package.json')));

// Nicer names for the networks you see most.
const NICE = {
  13335: 'Cloudflare', 16509: 'Amazon Web Services', 14618: 'Amazon Web Services', 15169: 'Google',
  396982: 'Google Cloud', 8075: 'Microsoft', 8068: 'Microsoft', 32934: 'Meta', 20940: 'Akamai',
  16625: 'Akamai', 54113: 'Fastly', 36459: 'GitHub', 14061: 'DigitalOcean', 20473: 'Vultr',
  46489: 'Twitch', 2906: 'Netflix', 714: 'Apple', 6185: 'Apple', 13414: 'X (Twitter)',
  35995: 'X (Twitter)', 19679: 'Dropbox', 62597: 'Discord', 49544: 'i3D.net', 8987: 'Amazon',
  396507: 'Anthropic', 399358: 'Anthropic', 138699: 'TikTok', 396986: 'TikTok', 31898: 'Oracle Cloud',
  24940: 'Hetzner', 16276: 'OVH', 63949: 'Akamai (Linode)', 209242: 'Cloudflare', 22822: 'Edgio',
  60068: 'CDN77', 212238: 'CDN77', 577: 'Bell Canada', 812: 'Rogers', 852: 'Telus', 6327: 'Shaw',
};

function cleanName(name) {
  return name
    .replace(/^"|"$/g, '')
    .replace(/,?\s+(Inc\.?|LLC|L\.L\.C\.|Ltd\.?|Limited|Corporation|Corp\.?|GmbH|B\.V\.|S\.A\.|Co\.)$/i, '')
    .replace(/-AS(N)?\b.*$/i, '')
    .trim();
}

function parseLine(line) {
  // start,end,asn,"Name, with commas"
  const a = line.indexOf(','), b = line.indexOf(',', a + 1), c = line.indexOf(',', b + 1);
  if (c < 0) return null;
  return [line.slice(0, a), line.slice(a + 1, b), Number(line.slice(b + 1, c)), line.slice(c + 1)];
}

let v4 = null, v6 = null;

function load() {
  if (v4) return;
  const names = [], nameIndex = new Map();
  const idx = (n) => { if (!nameIndex.has(n)) { nameIndex.set(n, names.length); names.push(n); } return nameIndex.get(n); };

  const lines4 = fs.readFileSync(path.join(DIR, 'asn-ipv4-num.csv'), 'utf8').split('\n');
  const s4 = new Uint32Array(lines4.length), e4 = new Uint32Array(lines4.length), n4 = new Int32Array(lines4.length), a4 = new Int32Array(lines4.length);
  let k = 0;
  for (const line of lines4) {
    const p = parseLine(line); if (!p) continue;
    s4[k] = Number(p[0]); e4[k] = Number(p[1]); a4[k] = p[2]; n4[k] = idx(p[3]); k++;
  }
  v4 = { s: s4.subarray(0, k), e: e4.subarray(0, k), n: n4.subarray(0, k), a: a4.subarray(0, k), names };

  const lines6 = fs.readFileSync(path.join(DIR, 'asn-ipv6-num.csv'), 'utf8').split('\n');
  const s6 = [], e6 = [], n6 = [], a6 = [];
  for (const line of lines6) {
    const p = parseLine(line); if (!p) continue;
    s6.push(BigInt(p[0])); e6.push(BigInt(p[1])); a6.push(p[2]); n6.push(idx(p[3]));
  }
  v6 = { s: s6, e: e6, n: n6, a: a6, names };
}

function ipv4ToNum(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((x) => !(x >= 0 && x <= 255))) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function ipv6ToBig(ip) {
  let [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [], t = tail !== undefined ? (tail ? tail.split(':') : []) : null;
  const groups = t === null ? h : [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
  if (groups.length !== 8) return null;
  return groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g || '0', 16)), 0n);
}

function search(table, x) {
  let lo = 0, hi = table.s.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (x < table.s[mid]) hi = mid - 1;
    else if (x > table.e[mid]) lo = mid + 1;
    else return mid;
  }
  return -1;
}

function lookupAsn(ip) {
  load();
  ip = ip.replace(/^::ffff:/i, '');
  let table, x;
  if (ip.includes(':')) { table = v6; x = ipv6ToBig(ip); } else { table = v4; x = ipv4ToNum(ip); }
  if (x === null) return null;
  const i = search(table, x);
  if (i < 0) return null;
  const asn = table.a[i];
  const raw = table.names[table.n[i]];
  return { asn, org: NICE[asn] || cleanName(raw), rawOrg: raw.replace(/^"|"$/g, '') };
}

module.exports = { lookupAsn, loadAsn: load };
