import json, numpy as np
g = json.load(open(r'C:\Users\Ibrah\OneDrive\Documents\HackWestern\outbound-integration\public\data\countries.geojson', encoding='utf-8'))
names, rings = [], []
for f in g['features']:
    geom = f['geometry']; nm = f['properties']['ADMIN']
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    for p in polys: rings.append((len(names), np.array(p[0], dtype=np.float64)))
    names.append(nm)
pts = []
for lat in np.arange(-56, 84, 1.4):
    step = 1.4 / max(0.2, np.cos(np.radians(lat)))
    for lon in np.arange(-180, 180, step): pts.append((lon, lat))
pts = np.array(pts); owner = np.full(len(pts), -1)
for ci, r in rings:
    x0, y0 = r[:, 0].min(), r[:, 1].min(); x1, y1 = r[:, 0].max(), r[:, 1].max()
    idx = np.where((pts[:, 0] >= x0) & (pts[:, 0] <= x1) & (pts[:, 1] >= y0) & (pts[:, 1] <= y1) & (owner < 0))[0]
    if not len(idx): continue
    px, py = pts[idx, 0], pts[idx, 1]; inside = np.zeros(len(idx), bool)
    xa, ya = r[:, 0], r[:, 1]; xb, yb = np.roll(xa, -1), np.roll(ya, -1)
    for k in range(len(xa)):
        c = ((ya[k] > py) != (yb[k] > py)) & (px < (xb[k] - xa[k]) * (py - ya[k]) / (yb[k] - ya[k] + 1e-12) + xa[k])
        inside ^= c
    owner[idx[inside]] = ci
m = owner >= 0
np.savez('globe_dots.npz', lon=pts[m, 0], lat=pts[m, 1], owner=owner[m], names=np.array(names))
print('land dots', m.sum(), 'of', len(pts))
