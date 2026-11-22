# Outbound promo v2: denser text, real logos, animated globe/laptop/dossier, Auth0 graphic.
import math, random, subprocess, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1920, 1080, 30
DUR = 40.6
FF = r"C:\Users\Ibrah\AppData\Local\Programs\Python\Python314\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe"
B0, P = 3.07, 0.5139
def beat(k): return B0 + P * k

WHITE, GREY, DIM = (255, 255, 255), (150, 150, 150), (90, 90, 90)
RED, ORANGE, CYAN = (255, 255, 255), (205, 205, 205), (150, 150, 150)   # monochrome edit

_fc = {}
def bahn(size, style='Bold Condensed'):
    key = ('b', size, style)
    if key not in _fc:
        f = ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf', size); f.set_variation_by_name(style); _fc[key] = f
    return _fc[key]
def semi(size): return bahn(size, 'SemiBold SemiCondensed')
def mono(size, bold=False):
    key = ('m', size, bold)
    if key not in _fc: _fc[key] = ImageFont.truetype('C:/Windows/Fonts/consolab.ttf' if bold else 'C:/Windows/Fonts/consola.ttf', size)
    return _fc[key]

def ease(x): x = min(1, max(0, x)); return 1 - (1 - x) ** 3
def ease_io(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def lerp(a, b, x): return a + (b - a) * x
def tw(font, s): return font.getlength(s)
def text_c(d, cx, y, s, font, fill=WHITE): d.text((cx - tw(font, s) / 2, y), s, font=font, fill=fill)
def fade(c, a): return tuple(int(v * a) for v in c)
def wrap(s, font, maxw):
    out, line = [], ''
    for w in s.split():
        t = (line + ' ' + w).strip()
        if tw(font, t) > maxw and line: out.append(line); line = w
        else: line = t
    if line: out.append(line)
    return out
def para(d, x, y, s, font, maxw, fill=WHITE, lh=None):
    lh = lh or font.size * 1.12
    for i, l in enumerate(wrap(s, font, maxw)): d.text((x, y + i * lh), l, font=font, fill=fill)
    return y + len(wrap(s, font, maxw)) * lh

grid = Image.new('RGB', (W, H), (0, 0, 0)); gd = ImageDraw.Draw(grid)
for x in range(0, W, 60): gd.line([(x, 0), (x, H)], fill=(13, 13, 13))
for y in range(0, H, 60): gd.line([(0, y), (W, y)], fill=(13, 13, 13))

# ---------- logos ----------
LOGO_META = json.load(open('logos/index.json'))
_glyph = {}
def glyph(slug, size):
    key = (slug, size)
    if key not in _glyph:
        im = Image.open(f'logos/{slug}.png').convert('RGBA')
        s = size / max(im.size); im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        _glyph[key] = im.split()[3]
    return _glyph[key]
def brand(slug):
    h = LOGO_META[slug]['hex']; c = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    return (150, 150, 150)
def draw_logo(img, d, slug, cx, cy, r, a=1.0, shape='c', ring=True):
    col = fade(brand(slug), a)
    if shape == 'c': d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 0, 0), outline=col if ring else None, width=3)
    else: d.rounded_rectangle([cx - r, cy - r, cx + r, cy + r], radius=int(r * 0.38), fill=(0, 0, 0), outline=col if ring else None, width=3)
    g = glyph(slug, int(r * 1.1))
    m = g if a >= 0.99 else g.point(lambda v: int(v * a))
    img.paste(WHITE, (int(cx - g.width / 2), int(cy - g.height / 2)), m)

FIELD_SLUGS = [s for s in LOGO_META]
fr = random.Random(11)
FIELD = []
row = 0
for y in range(150, 1000, 112):
    off = 0 if row % 2 == 0 else 62
    for x in range(70 + off, 1890, 124):
        FIELD.append([x + fr.uniform(-14, 14), y + fr.uniform(-12, 12), fr.choice(FIELD_SLUGS), fr.uniform(30, 40), fr.choice('cs'), fr.uniform(0, 6.28)])
    row += 1
fr.shuffle(FIELD_SLUGS)
for i, f in enumerate(FIELD): f[2] = FIELD_SLUGS[i % len(FIELD_SLUGS)]
def field_pos(i, t):
    x, y, _, _, _, ph = FIELD[i]
    return x + 9 * math.sin(t * 0.9 + ph), y + 7 * math.cos(t * 0.8 + ph * 1.3)
def beat_pulse(t):
    k = (t - B0) / P; return max(0, 1 - (k - math.floor(k)) / 0.35)
def draw_field(img, d, t, a=0.8, avoid=None):
    p = beat_pulse(t); kk = int((t - B0) / P)
    for i, (x, y, slug, r, shape, ph) in enumerate(FIELD):
        cx, cy = field_pos(i, t)
        if avoid and avoid[0] - 30 < cx < avoid[2] + 30 and avoid[1] - 30 < cy < avoid[3] + 30: continue
        if cx > 1660 and cy < 175: continue      # keep the eye corner clear
        rr = r * (1 + (0.15 * p if (i + kk) % 5 == 0 else 0))
        draw_logo(img, d, slug, cx, cy, rr, a, shape)

SLOTS2 = [(150, 165), (400, 150), (650, 165), (900, 150), (1150, 165), (1400, 150),
          (1790, 330), (1640, 470), (1790, 620), (1640, 770),
          (1560, 925), (1310, 915), (1060, 925), (810, 915), (560, 925), (310, 915), (110, 900),
          (110, 330), (230, 470), (110, 620), (230, 770), (1640, 320)]
SLUGS2 = ['instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'whatsapp', 'google', 'googlechrome', 'spotify', 'discord',
          'netflix', 'threads', 'messenger', 'amazon', 'x', 'reddit', 'pinterest', 'twitch', 'telegram', 'steam', 'zoom', 'uber']
def slot_pos(i, t):
    x, y = SLOTS2[i]
    return x + 18 * math.sin(t * 0.9 + i * 1.7), y + 14 * math.cos(t * 0.7 + i * 2.3)
def floating2(img, d, t, a=1.0):
    p = beat_pulse(t); kk = int((t - B0) / P)
    for i, slug in enumerate(SLUGS2):
        x, y = slot_pos(i, t); r = 40 * (1 + (0.14 * p if i % 3 == kk % 3 else 0))
        d.rounded_rectangle([x - r, y - r, x + r, y + r], radius=int(r * 0.3), fill=(0, 0, 0), outline=fade((150, 150, 150), a), width=3)
        g = glyph(slug, int(r * 1.05)); img.paste(fade(WHITE, a), (int(x - g.width / 2), int(y - g.height / 2)), g)
        text_c(d, x, y + r + 6, LOGO_META[slug]['title'].upper(), mono(15), fade(GREY, a))
N2 = len(SLUGS2)
GLITCH = [beat(5), beat(8), beat(11), beat(14), 11.86, 13.94, 16.10, 18.32, 20.04, 22.22, 24.36, 26.44]
def slice_glitch(img, t, g):
    arr = np.asarray(img).copy(); rr = random.Random(int(g * 1000) + int((t - g) * 30))
    for _ in range(8):
        y0 = rr.randrange(0, H - 80); h = rr.randrange(8, 70); dx = rr.randrange(-60, 60)
        arr[y0:y0 + h] = np.roll(arr[y0:y0 + h], dx, axis=1)
    if g in (13.94, 22.22) and t - g < 1 / 30: arr = 255 - arr
    return Image.fromarray(arr)

def packets(d, pts_from, pts_to, t, color=WHITE, a=1.0, speed=1.1, n=2, size=4, line=(48, 48, 48)):
    for j, (p, q) in enumerate(zip(pts_from, pts_to)):
        if line: d.line([p, q], fill=fade(line, a), width=1)
        for k in range(n):
            u = (t * speed + j * 0.137 + k / n) % 1
            x, y = lerp(p[0], q[0], u), lerp(p[1], q[1], u)
            d.ellipse([x - size, y - size, x + size, y + size], fill=fade(color, a))

# ---------- ASCII logo ----------
BANNER = [r"  ___  _   _ _____ ____   ___  _   _ _   _ ____  ",
          r" / _ \| | | |_   _| __ ) / _ \| | | | \ | |  _ \ ",
          r"| | | | | | | | | |  _ \| | | | | | |  \| | | | |",
          r"| |_| | |_| | | | | |_) | |_| | |_| | |\  | |_| |",
          r" \___/ \___/  |_| |____/ \___/ \___/|_| \_|____/ "]
rng = random.Random(7)
reveal = [[rng.uniform(0.0, 0.62) for _ in r] for r in BANNER]
GLYPHS = '#@$%&*+=-:/\\|_<>'
def draw_banner(d, cx, cy, size, t, fill=WHITE):
    f = mono(size, True); cw = tw(f, 'M'); lh = size * 1.02
    x0 = cx - cw * len(BANNER[0]) / 2; y0 = cy - lh * len(BANNER) / 2
    for r, row_ in enumerate(BANNER):
        for c, ch in enumerate(row_):
            if ch == ' ': continue
            rt = reveal[r][c]
            if t >= rt: g, col = ch, fill
            elif t >= rt - 0.3: g, col = GLYPHS[int((t * 40 + r * 7 + c) % len(GLYPHS))], DIM
            else: continue
            d.text((x0 + c * cw, y0 + r * lh), g, font=f, fill=col)

# ---------- eye ----------
def draw_eye(img, cx, cy, w, openv, lx, ly, alpha=1.0, glow=False):
    S = 2
    pw, ph = int(w * 1.25), int(w * 0.95)
    L = Image.new('L', (pw * S, ph * S), 0); d = ImageDraw.Draw(L)
    ox, oy, hw, hh = pw * S / 2, ph * S / 2, w * S / 2, w * S * 0.30
    xs = np.linspace(-1, 1, 90)
    base = [oy + hh * 0.18 * (1 - openv) * (1 - x * x) for x in xs]
    shape = [(1 - x * x) ** 0.85 for x in xs]
    up = [(ox + x * hw, b - hh * openv * s) for x, b, s in zip(xs, base, shape)]
    lo = [(ox + x * hw, b + hh * openv * s) for x, b, s in zip(xs, base, shape)]
    lw = max(3, int(w * S * 0.02))
    if openv > 0.03:
        mask = Image.new('L', L.size, 0); ImageDraw.Draw(mask).polygon(up + lo[::-1], fill=255)
        iris = Image.new('L', L.size, 0); di = ImageDraw.Draw(iris)
        r = hh * 0.92; ix = ox + lx * hw * 0.42; iy = oy + ly * hh * 0.32
        di.ellipse([ix - r, iy - r, ix + r, iy + r], outline=255, width=lw)
        r2 = r * 0.74; di.ellipse([ix - r2, iy - r2, ix + r2, iy + r2], outline=140, width=max(1, lw // 2))
        for a in np.linspace(0, 2 * math.pi, 32, endpoint=False):
            di.line([(ix + math.cos(a) * r * 0.5, iy + math.sin(a) * r * 0.5),
                     (ix + math.cos(a) * r * 0.88, iy + math.sin(a) * r * 0.88)], fill=105, width=max(1, lw // 3))
        pr = r * 0.40; di.ellipse([ix - pr, iy - pr, ix + pr, iy + pr], fill=255)
        hr = pr * 0.30; hx, hy = ix - pr * 0.35, iy - pr * 0.35
        di.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=0)
        L.paste(iris, (0, 0), mask)
    d.line(up, fill=255, width=lw, joint='curve'); d.line(lo, fill=255, width=lw, joint='curve')
    if openv < 0.3:
        k = 1 - openv / 0.3
        for x in (-0.6, -0.35, -0.1, 0.15, 0.4, 0.62):
            i = int((x + 1) / 2 * (len(xs) - 1)); px, py = lo[i]
            d.line([(px, py), (px + x * hw * 0.06, py + hh * 0.32 * k)], fill=255, width=lw)
    L = L.resize((pw, ph), Image.LANCZOS)
    if alpha < 1: L = L.point(lambda v: int(v * alpha))
    box = (int(cx - pw / 2), int(cy - ph / 2))
    if glow:
        g = L.filter(ImageFilter.GaussianBlur(w * 0.03)).point(lambda v: int(v * 0.55)); img.paste(WHITE, box, g)
    img.paste(WHITE, box, L)

gr = random.Random(3)
gaze_pts = [(gr.uniform(-1, 1), gr.uniform(-0.9, 0.9)) for _ in range(400)]
def gaze(t):
    k = max(0, int((t - B0) / P)); tk = beat(k)
    a = gaze_pts[k % 400]; prev = gaze_pts[(k - 1) % 400]; x = ease((t - tk) / 0.12)
    return lerp(prev[0], a[0], x) + 0.05 * math.sin(t * 7), lerp(prev[1], a[1], x) + 0.05 * math.cos(t * 5)
BLINKS = [13.94, 22.22, 28.46, 33.56]
def blink(t):
    for b in BLINKS:
        if b <= t < b + 0.18: return abs((t - b) / 0.09 - 1)
    return 1.0
CORNER = (1792, 84, 190)
def eye_state(t):
    if t < 4.08: return None
    if t < 5.18: return (960, 400, 560, ease((t - 4.08) / 0.35) * blink(t), 1, True)
    if t < 5.62:
        x = ease_io((t - 5.18) / 0.44)
        return (lerp(960, CORNER[0], x), lerp(400, CORNER[1], x), lerp(560, CORNER[2], x), 1, 1, x < 0.5)
    if t < 36.5: return (*CORNER, blink(t), 1, False)
    if t < 38.2:
        x = ease_io((t - 36.5) / 1.7)
        return (lerp(CORNER[0], 960, x), lerp(CORNER[1], 540, x), lerp(CORNER[2], 1000, x), 1, 1, x > 0.4)
    if t < 39.26: return (960, 540, 1000, 1, 1, True)
    return (960, 540, 1000, 1 - ease_io((t - 39.26) / 0.96), 1, True)

def hud(d, section, count, source, a=1.0, right='VERIFIED · OUTBOUND DOSSIER'):
    d.text((60, 46), 'OUTBOUND_', font=mono(24, True), fill=fade(WHITE, a))
    d.text((210, 49), '// ' + section, font=mono(20), fill=fade(GREY, a))
    d.text((1560, 49), count, font=mono(20), fill=fade(GREY, a))
    d.line([(60, 92), (1660, 92)], fill=fade((60, 60, 60), a), width=1)
    d.line([(60, 1012), (1860, 1012)], fill=fade((60, 60, 60), a), width=1)
    d.text((60, 1024), source, font=mono(17), fill=fade(DIM, a))
    if right: d.text((1860 - tw(mono(17), right), 1024), right, font=mono(17), fill=fade(DIM, a))

def chips(d, x, y, items, maxw, font, color=WHITE, a=1.0, gap=10, pad=12):
    cx, cy, h = x, y, font.size + 14
    for s in items:
        w = tw(font, s) + pad * 2
        if cx + w > x + maxw: cx = x; cy += h + gap
        d.rounded_rectangle([cx, cy, cx + w, cy + h], radius=8, outline=fade(color, a), width=2)
        d.text((cx + pad, cy + 5), s, font=font, fill=fade(WHITE, a))
        cx += w + gap
    return cy + h

# ---------- company cards ----------
CARDS = [
    dict(t=beat(5), title='META', logos=['instagram', 'facebook', 'whatsapp', 'messenger', 'threads'], n='01',
         sub='INSTAGRAM · FACEBOOK · WHATSAPP · MESSENGER · THREADS',
         label='INSTAGRAM, APP STORE PRIVACY LABEL · DATA LINKED TO YOU',
         linked=['HEALTH & FITNESS', 'PURCHASES', 'FINANCIAL INFO', 'LOCATION', 'CONTACT INFO', 'CONTACTS', 'USER CONTENT',
                 'SEARCH HISTORY', 'BROWSING HISTORY', 'IDENTIFIERS', 'USAGE DATA', 'SENSITIVE INFO', 'DIAGNOSTICS', 'OTHER DATA'],
         track=['CONTACT INFO', 'IDENTIFIERS', 'OTHER DATA'],
         quote='deceiving users about their ability to control the privacy of their personal information',
         qsrc='U.S. FTC, "FTC Imposes $5 Billion Penalty and Sweeping New Privacy Restrictions on Facebook", Jul 24 2019',
         items=[('€1.2B', '2023 · IRELAND DPC', "Transfers of Facebook users' personal data from the EU/EEA to the United States", 'dataprotection.ie · May 2023'),
                ('$5B', '2019 · U.S. FTC', 'Phone numbers given for two-factor security were also used for advertising, the FTC said', 'ftc.gov · Jul 24 2019'),
                ('€405M', '2022 · IRELAND DPC', "Instagram: children's contact details made public and accounts public by default", 'dataprotection.ie · Sep 2022'),
                ('$1.4B', '2024 · TEXAS', 'Settlement over facial recognition and biometric consent on Facebook', 'Texas Attorney General · Jul 2024')]),
    dict(t=beat(8), title='TIKTOK', logos=['tiktok', 'capcut'] if 'capcut' in LOGO_META else ['tiktok'], n='02',
         sub='BYTEDANCE · TIKTOK LTD.',
         label='TIKTOK, APP STORE PRIVACY LABEL · DATA LINKED TO YOU',
         linked=['PRECISE LOCATION', 'COARSE LOCATION', 'PHOTOS OR VIDEOS', 'AUDIO DATA', 'CONTACTS', 'SEARCH HISTORY',
                 'BROWSING HISTORY', 'PURCHASE HISTORY', 'FINANCIAL INFO', 'EMAIL', 'PHONE NUMBER', 'DEVICE ID', 'USER ID', 'ADVERTISING DATA'],
         track=['CONTACT INFO', 'IDENTIFIERS'],
         quote='limited EEA User Data had in fact been stored on servers in China',
         qsrc='Irish Data Protection Commission, €530 million TikTok decision, May 2 2025',
         items=[('€530M', '2025 · IRELAND DPC', 'Personal data of EEA users "remotely accessed by staff in China"', 'dataprotection.ie · May 2 2025'),
                ('€345M', '2023 · IRELAND DPC', "Children's default settings, transparency and age verification", 'dataprotection.ie · Sep 2023'),
                ('$5.7M', '2019 · U.S. FTC', 'Musical.ly (now TikTok) collected "personal information from kids without parental consent"', 'ftc.gov · Feb 27 2019'),
                ('2025', 'CANADA · JOINT INVESTIGATION', "Privacy commissioners examined age assurance and TikTok's handling of children's information", 'priv.gc.ca · PIPEDA 2025-003')]),
    dict(t=beat(11), title='GOOGLE', logos=['google', 'youtube', 'googlechrome', 'gmail', 'googlemaps'], n='03',
         sub='YOUTUBE · CHROME · GMAIL · MAPS · SEARCH',
         label='YOUTUBE LABEL + GOOGLE PRIVACY POLICY · WHAT IS COLLECTED',
         linked=['PURCHASES', 'FINANCIAL INFO', 'LOCATION', 'CONTACTS', 'SEARCH HISTORY', 'BROWSING HISTORY', 'VIDEOS YOU WATCH',
                 'GPS & SENSOR DATA', 'WI-FI, CELL TOWERS, BLUETOOTH NEARBY', 'IP ADDRESS', 'SAVED AUDIO SAMPLES', 'IDENTIFIERS', 'USAGE DATA'],
         track=['CONTACT INFO', 'IDENTIFIERS'],
         quote='analyze and listen to samples of saved user audio',
         qsrc='Google Privacy Policy (to improve audio recognition), effective Oct 16 2026',
         items=[('$1.375B', '2025 · TEXAS', 'Settlement of claims involving location, browsing and biometric data', 'Texas Attorney General · 2025'),
                ('$391.5M', '2022 · MULTISTATE', 'Multistate settlement over Google location tracking practices', 'New York Attorney General · 2022'),
                ('$170M', '2019 · U.S. FTC', '"YouTube touted its popularity with children to prospective corporate clients"', 'ftc.gov · Sep 4 2019'),
                ('€325M', '2025 · FRANCE CNIL', 'Ads shown between Gmail emails without consent; cookies without valid consent', 'cnil.fr · Sep 3 2025')]),
    dict(t=beat(14), title='AND THE REST', logos=['whatsapp', 'snapchat', 'discord'], n='04',
         sub='WHATSAPP · SNAPCHAT · DISCORD',
         label='APP STORE PRIVACY LABELS · DATA LINKED TO YOU',
         groups=[('WHATSAPP', ['PURCHASES', 'FINANCIAL INFO', 'LOCATION', 'CONTACTS', 'USER CONTENT', 'IDENTIFIERS', 'USAGE DATA']),
                 ('SNAPCHAT', ['PURCHASES', 'LOCATION', 'CONTACTS', 'USER CONTENT', 'SEARCH HISTORY', 'IDENTIFIERS']),
                 ('DISCORD', ['PURCHASES', 'CONTACT INFO', 'USER CONTENT', 'SEARCH HISTORY', 'IDENTIFIERS', 'DIAGNOSTICS'])],
         quote='We similarly collect and store the messages you send',
         qsrc='Discord Privacy Policy, effective Sep 29 2025',
         items=[('€225M', '2021 · IRELAND · WHATSAPP', 'Transparency failures, including processing "between WhatsApp and other Facebook companies"', 'dataprotection.ie · Sep 2 2021'),
                ('FTC', '2014 · U.S. · SNAPCHAT', 'Collected iOS users\' contacts "from their address books without notice or consent"', 'ftc.gov · May 8 2014'),
                ('FTC', '2014 · U.S. · SNAPCHAT', '"Transmitted geolocation information" from its Android app; disappearing-message promises were false', 'ftc.gov · May 8 2014'),
                ('€800K', '2022 · FRANCE · DISCORD', "Sanctioned by France's privacy regulator, CNIL", 'cnil.fr · 2022')]),
]

def scene_card(img, d, t, c):
    d.line([(960, 120), (960, 995)], fill=(50, 50, 50), width=1)
    hud(d, 'WHO IS WATCHING', f"{c['n']} / 04", 'Collection lists: Apple App Store privacy labels and company privacy policies. Cases: regulator and court sources.')
    d.text((70, 112), 'COMPANY ' + c['n'] + ' · ' + c['sub'], font=mono(19), fill=GREY)
    d.text((66, 132), c['title'], font=bahn(124), fill=WHITE)
    x = 80 + tw(bahn(124), c['title'])
    for i, s in enumerate(c['logos']):
        draw_logo(img, d, s, x + 50 + i * 82, 205, 34, 1, 's')
    y = 290
    d.text((70, y), '[ WHAT THEY COLLECT ]  ' + c['label'], font=mono(17, True), fill=GREY)
    y += 30
    if 'groups' in c:
        for name, items in c['groups']:
            d.text((70, y + 6), name, font=mono(20, True), fill=WHITE)
            y = chips(d, 200, y, items, 730, semi(20), (120, 120, 120), gap=7, pad=9) + 8
    else:
        y = chips(d, 70, y, c['linked'], 860, semi(21), (120, 120, 120), gap=7, pad=9) + 14
        d.text((70, y), "[ USED TO TRACK YOU ACROSS OTHER COMPANIES' APPS AND SITES ]", font=mono(17, True), fill=RED)
        y = chips(d, 70, y + 28, c['track'], 860, semi(21), RED, gap=7, pad=9) + 14
    y += 8
    d.text((66, y - 22), '\u201c', font=bahn(110), fill=GREY)
    y = para(d, 120, y + 14, c['quote'] + '\u201d', semi(48), 790, WHITE, 54)
    para(d, 120, y + 10, '— ' + c['qsrc'], mono(20), 790, GREY, 24)
    d.text((990, 112), '[ WHAT THEY WERE CAUGHT FOR ]', font=mono(19, True), fill=GREY)
    for i, (amt, meta, desc, src) in enumerate(c['items']):
        st = c['t'] + max(0, i - 1) * P
        if t < st: continue
        a = ease((t - st) / 0.12); y = 140 + i * 216 + (1 - a) * 24
        d.text((990, y + 6), 'ABCD'[i], font=mono(24, True), fill=fade(GREY, a))
        d.text((1026, y - 8), amt, font=bahn(80), fill=fade(WHITE, a))
        d.text((1030 + tw(bahn(80), amt) + 18, y + 40), meta, font=mono(19), fill=fade(GREY, a))
        yy = para(d, 1028, y + 86, desc, semi(30), 820, fade(WHITE, a), 34)
        d.text((1028, yy + 4), 'SOURCE: ' + src, font=mono(16), fill=fade(DIM, a))

# ---------- what they do with it ----------
USES = [
    (13.94, 'A', 'WHAT YOU DO IN OTHER APPS PERSONALIZES THEIR ADS', [
        ('businesses often share data about people\u2019s interactions on their websites with ad platforms',
         'Meta Newsroom, "Now You Can See and Control the Data That Apps and Websites Share With Facebook", Aug 20 2019'),
        ('we may also show you personalized ads based on your interests, activity',
         'Google Privacy Policy, effective Oct 16 2026'),
        ('displaying advertisements between users\u2019 Gmail emails without their consent',
         'CNIL, €325 million fine against Google, Sep 3 2025 (translated from French)')]),
    (16.10, 'B', 'WHAT YOU WATCH FEEDS THE ALGORITHM THAT PICKS WHAT YOU SEE NEXT', [
        ('the videos you like or share, accounts you follow, comments you post',
         'TikTok Newsroom, "How TikTok recommends videos #ForYou", Jun 18 2020'),
        ('whether a user finishes watching a longer video from beginning to end',
         'Same TikTok post: a strong signal that gets greater weight'),
        ('the videos you watch and the things you search for are saved in your account',
         'Google Privacy Policy, effective Oct 16 2026 (with YouTube History on)')]),
    (18.32, 'C', 'PURCHASES, LOCATION, CONTACTS, BROWSING HISTORY: LINKED TO YOU', [
        ('Health & Fitness · Financial Info · Location · Contacts · Browsing History · Sensitive Info',
         'Instagram, Apple App Store privacy label, "Data Linked to You", Nov 2026'),
        ('collected iOS users\u2019 contacts information from their address books without notice or consent',
         'U.S. FTC, Snapchat settlement press release, May 8 2014'),
        ('GPS and other sensor data from your device · Wi-Fi access points, cell towers, and Bluetooth',
         'Google Privacy Policy, location sources, effective Oct 16 2026')]),
    (20.04, 'D', 'AND THE APPS SHARE IT WITH EACH OTHER', [
        ('Our API provided partners with access to the person\u2019s messages',
         'Meta Newsroom, "Let\u2019s Clear Up a Few Things About Facebook\u2019s Partners", Dec 18 2018'),
        ('the personal data of EEA users, remotely accessed by staff in China',
         'Irish Data Protection Commission, €530 million TikTok decision, May 2 2025'),
        ('did not disclose that it also used those numbers for advertising purposes',
         'U.S. FTC on Facebook and phone numbers given for two-factor security, Jul 24 2019')]),
]
STATS = [
    (22.22, '104 / 497', 'SITES WE VISITED HAD TRACKERS WATCHING'),
    (24.36, '162', 'TRACKER COMPANIES SAW ONE LAPTOP BROWSE'),
    (26.44, '378', 'TRACKER COOKIE DOMAINS SITTING ON THE PC'),
]

def scene_use(img, d, t, cur):
    st, tag, head, pts = cur
    X0, Y0, X1, Y1 = 320, 222, 1600, 885
    d.rectangle((X0, Y0, X1, Y1), fill=(0, 0, 0), outline=(110, 110, 110), width=2)
    d.text((X0 + 20, Y0 + 12), f'[{tag}] WHAT THEY DO WITH IT', font=mono(18, True), fill=GREY)
    a = ease((t - st) / 0.15)
    y = para(d, X0 + 20, Y0 + 42 + (1 - a) * 16, head, bahn(62), X1 - X0 - 40, fade(WHITE, a), 64)
    y = max(y, Y0 + 170) + 14
    d.line([(X0 + 20, y), (X1 - 20, y)], fill=(60, 60, 60), width=1)
    colw = (X1 - X0 - 40) / 3
    for i, (q, src) in enumerate(pts):
        s2 = st + i * P * 0.7
        if t < s2: continue
        b = ease((t - s2) / 0.14); x = X0 + 20 + i * colw
        d.text((x, y + 14), f'{tag}{i + 1}', font=mono(18, True), fill=fade(WHITE, b))
        d.text((x - 4, y + 26), '\u201c', font=bahn(80), fill=fade(GREY, b))
        yy = para(d, x + 30, y + 48, q + '\u201d', semi(38), colw - 50, fade(WHITE, b), 42)
        d.line([(x + 30, yy + 10), (x + 80, yy + 10)], fill=fade(GREY, b), width=2)
        para(d, x + 30, yy + 20, src, mono(17), colw - 50, fade(GREY, b), 21)
    return

    box = (110, 118, 1640, 990)
    d.rectangle(box, fill=(0, 0, 0), outline=(110, 110, 110), width=2)
    d.text((134, 132), f'[{tag}] WHAT THEY DO WITH IT', font=mono(20, True), fill=GREY)
    a = ease((t - st) / 0.15)
    y = para(d, 132, 165 + (1 - a) * 20, head, bahn(84), 1480, fade(WHITE, a), 86)
    y = max(y, 300) + 20
    d.line([(134, y), (1616, y)], fill=(60, 60, 60), width=1)
    for i, (q, src) in enumerate(pts):
        s2 = st + i * P * 0.7
        if t < s2: continue
        b = ease((t - s2) / 0.14); x = 134 + i * 500
        d.text((x, y + 18), f'{tag}{i + 1}', font=mono(20, True), fill=fade(ORANGE, b))
        d.text((x - 4, y + 34), '\u201c', font=bahn(96), fill=fade(GREY, b))
        yy = para(d, x + 34, y + 64, q + '\u201d', semi(58), 446, fade(WHITE, b), 64)
        d.line([(x + 34, yy + 12), (x + 90, yy + 12)], fill=fade(ORANGE, b), width=2)
        para(d, x + 34, yy + 26, src, mono(21), 446, fade(GREY, b), 26)

# ---------- globe ----------
GD = np.load('globe_dots.npz')
G_LON, G_LAT, G_OWN, G_NAMES = np.radians(GD['lon']), np.radians(GD['lat']), GD['owner'], list(GD['names'])
HL = {G_NAMES.index(n): c for n, c in [('United States of America', ORANGE), ('Canada', (165, 165, 165)), ('Ireland', RED),
                                         ('Sweden', ORANGE), ('Netherlands', ORANGE), ('United Kingdom', RED)] if n in G_NAMES}
ORIGIN = (42.98, -81.25)  # London, Ontario
DESTS = [((39.04, -77.49), ORANGE), ((47.6, -122.3), ORANGE), ((37.77, -122.42), RED), ((32.8, -96.8), ORANGE),
         ((53.35, -6.26), RED), ((59.33, 18.07), ORANGE), ((52.37, 4.9), ORANGE), ((51.5, -0.12), RED),
         ((43.65, -79.38), (165, 165, 165)), ((45.5, -73.6), (165, 165, 165)), ((41.88, -87.63), RED)]
def proj(lat, lon, lat0, lon0, R, cx, cy):
    cl = np.cos(lat); x = cx + R * cl * np.sin(lon - lon0)
    y = cy - R * (np.cos(lat0) * np.sin(lat) - np.sin(lat0) * cl * np.cos(lon - lon0))
    vis = np.sin(lat0) * np.sin(lat) + np.cos(lat0) * cl * np.cos(lon - lon0)
    return x, y, vis
def slerp(a, b, u):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    p1 = np.array([math.cos(la1) * math.cos(lo1), math.cos(la1) * math.sin(lo1), math.sin(la1)])
    p2 = np.array([math.cos(la2) * math.cos(lo2), math.cos(la2) * math.sin(lo2), math.sin(la2)])
    om = math.acos(max(-1, min(1, p1 @ p2))) or 1e-6
    p = (math.sin((1 - u) * om) * p1 + math.sin(u * om) * p2) / math.sin(om)
    return math.asin(p[2]), math.atan2(p[1], p[0]), om
def draw_globe(img, d, t, st, cx, cy, R, cursor_cb=None):
    lon0 = math.radians(lerp(-112, -42, (t - st) / 1.08)); lat0 = math.radians(26)
    d.ellipse([cx - R - 30, cy - R - 30, cx + R + 30, cy + R + 30], fill=(0, 0, 0))
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(70, 70, 70), width=2)
    for latg in range(-60, 90, 30):
        ls = np.radians(np.full(120, latg)); lo = np.linspace(-math.pi, math.pi, 120)
        x, y, v = proj(ls, lo, lat0, lon0, R, cx, cy)
        for i in range(119):
            if v[i] > 0 and v[i + 1] > 0: d.line([(x[i], y[i]), (x[i + 1], y[i + 1])], fill=(32, 32, 32))
    x, y, v = proj(G_LAT, G_LON, lat0, lon0, R, cx, cy)
    arr = np.asarray(img).copy()
    m = v > 0
    xs, ys, own, vv = x[m].astype(int), y[m].astype(int), G_OWN[m], v[m]
    for xi, yi, o, vi in zip(xs, ys, own, vv):
        c = HL.get(o); shade = 0.45 + 0.55 * vi
        col = np.array(c if c else (92, 92, 92)) * shade
        arr[yi - 2:yi + 2, xi - 2:xi + 2] = col
    img.paste(Image.fromarray(arr)); d = ImageDraw.Draw(img)
    for j, (dst, col) in enumerate(DESTS):
        prog = ease((t - st - j * 0.03) / 0.35)
        pts = []
        for k in range(41):
            u = k / 40 * prog
            la, lo, om = slerp(ORIGIN, dst, u)
            h = 1 + 0.25 * om * math.sin(math.pi * u)
            px, py, pv = proj(np.array(la), np.array(lo), lat0, lon0, R * h, cx, cy)
            pts.append((float(px), float(py), float(pv) > -0.15))
        for k in range(len(pts) - 1):
            if pts[k][2] and pts[k + 1][2]: d.line([pts[k][:2], pts[k + 1][:2]], fill=col, width=3)
        if prog >= 1:
            for off in (0, 0.33, 0.66):
                u = (t * 1.6 + j * 0.21 + off) % 1; k = int(u * 40)
                if pts[k][2]:
                    px, py = pts[k][:2]; d.ellipse([px - 6, py - 6, px + 6, py + 6], fill=WHITE)
    ox, oy, ov = proj(np.array(math.radians(ORIGIN[0])), np.array(math.radians(ORIGIN[1])), lat0, lon0, R, cx, cy)
    if ov > 0: d.ellipse([ox - 9, oy - 9, ox + 9, oy + 9], outline=WHITE, width=3)
    def where(lat, lon):
        px, py, pv = proj(np.array(math.radians(lat)), np.array(math.radians(lon)), lat0, lon0, R, cx, cy)
        return float(px), float(py)
    return where

def draw_cursor(d, x, y, click=0.0):
    pts = [(x, y), (x, y + 34), (x + 9, y + 26), (x + 16, y + 41), (x + 22, y + 38), (x + 15, y + 24), (x + 26, y + 24)]
    d.polygon(pts, fill=WHITE, outline=(0, 0, 0))
    if click > 0:
        r = 10 + 26 * (1 - click); d.ellipse([x - r, y - r, x + r, y + r], outline=fade(ORANGE, click), width=3)
def tooltip(d, x, y, title, sub, col=ORANGE):
    w = max(tw(semi(30), title), tw(mono(18), sub)) + 30
    d.rectangle([x, y, x + w, y + 74], fill=(10, 10, 10), outline=col, width=2)
    d.text((x + 14, y + 6), title, font=semi(30), fill=WHITE); d.text((x + 14, y + 44), sub, font=mono(18), fill=col)

# ---------- screenshots ----------
def inset_img(path):
    return Image.open(path).convert('RGB').resize((1280, 720), Image.LANCZOS)
IX, IY, SC = 320, 260, 1280 / 1920
SHOT_GLOBE = inset_img('cap/globe.png')
SHOT_COMP = inset_img('cap/computer.png')
DOSS = [('youtube', 14), ('discord', 3), ('snapchat', 10), ('spotify', 4), ('zoom', 6)]
SHOT_DOSS = {k: inset_img(f'cap/dossier-{k}.png') for k, _ in DOSS}
BOXES = json.load(open('cap/boxes.json'))
def to_inset(x, y): return IX + x * SC, IY + y * SC
APP_PTS = [to_inset(b['x'] + b['w'] / 2, b['y'] + b['h'] * 0.38) for b in BOXES['apps']]
ORG_PTS = [to_inset(b['x'] + b['w'] / 2, b['y'] + b['h'] / 2) for b in BOXES['orgs'] if b['w'] > 0 and 150 < b['y'] < 300]
er = random.Random(5)
EDGES = []
for i, p in enumerate(APP_PTS):
    for o in er.sample(range(len(ORG_PTS)), min(2, len(ORG_PTS))): EDGES.append((p, ORG_PTS[o], ORANGE if er.random() < 0.6 else RED))
    for j in er.sample(range(len(APP_PTS)), 2):
        if j != i: EDGES.append((p, APP_PTS[j], CYAN))
def curve(p, q, bend=0.18):
    mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2; dx, dy = q[0] - p[0], q[1] - p[1]
    c = (mx - dy * bend, my + dx * bend)
    return [((1 - u) ** 2 * p[0] + 2 * (1 - u) * u * c[0] + u * u * q[0], (1 - u) ** 2 * p[1] + 2 * (1 - u) * u * c[1] + u * u * q[1]) for u in np.linspace(0, 1, 60)]
EDGE_CURVES = [(curve(p, q, 0.15 if col != CYAN else 0.35), col) for p, q, col in EDGES]

def frame_inset(d):
    d.rectangle([IX - 2, IY - 2, IX + 1282, IY + 722], outline=(140, 140, 140), width=2)
    for cx, cy, sx, sy in ((IX - 2, IY - 2, 1, 1), (IX + 1282, IY - 2, -1, 1), (IX - 2, IY + 722, 1, -1), (IX + 1282, IY + 722, -1, -1)):
        d.line([(cx, cy), (cx + 40 * sx, cy)], fill=WHITE, width=4); d.line([(cx, cy), (cx, cy + 40 * sy)], fill=WHITE, width=4)
def legend(d, x, y, items):
    for i, (col, s) in enumerate(items):
        d.line([(x, y + 12 + i * 30), (x + 34, y + 12 + i * 30)], fill=col, width=4)
        d.ellipse([x + 13, y + 8 + i * 30, x + 21, y + 16 + i * 30], fill=WHITE)
        d.text((x + 46, y + i * 30), s, font=mono(19), fill=WHITE)

FEATURES = [(31.50, 'GLOBE', '01', 'SEE WHICH COUNTRY YOUR DATA LANDS IN'),
            (32.58, 'COMPUTER', '02', 'EVERY APP. EVERY COMPANY IT TALKS TO. LIVE.'),
            (33.56, 'DOSSIER', '03', '330+ APPS · 240+ VERIFIED FINES, CASES & INVESTIGATIONS')]

def scene_feature(img, d, t, cur):
    st, name, n, title = cur
    d.text((80, 112), 'FEATURE ' + n + ' · ' + name + ' VIEW', font=mono(22), fill=GREY)
    d.text((78, 140), title, font=bahn(76), fill=WHITE)
    if name == 'GLOBE':
        img.paste(SHOT_GLOBE, (IX, IY)); d = ImageDraw.Draw(img)
        where = draw_globe(img, d, t, st, IX + 505, IY + 420, 262); d = ImageDraw.Draw(img)
        # cursor checks Ireland, then the United States; the side panel rows light up
        lt = t - st
        ie, us = where(53.35, -6.26), where(39.5, -98)
        if lt < 0.45: cx, cy = lerp(1500, ie[0], ease(lt / 0.35)), lerp(700, ie[1], ease(lt / 0.35))
        else: cx, cy = lerp(ie[0], us[0], ease((lt - 0.5) / 0.3)), lerp(ie[1], us[1], ease((lt - 0.5) / 0.3))
        rows = [('UNITED STATES', 0, '89'), ('IRELAND', 2, '4')]
        if 0.35 < lt < 0.5 or lt >= 0.8:
            nm, ri, cnt = rows[1] if lt < 0.5 else rows[0]
            tooltip(d, cx + 30, cy + 20, nm, f'{cnt} ENDPOINTS · ESTIMATED', RED if nm == 'IRELAND' else ORANGE)
            ry = IY + (286 + ri * 39) * SC - 10
            d.rectangle([IX + 1500 * SC, ry, IX + 1890 * SC, ry + 26], outline=ORANGE, width=2)
        draw_cursor(d, cx, cy, max(0, 1 - abs(lt - 0.4) / 0.1) if lt < 0.5 else max(0, 1 - abs(lt - 0.85) / 0.1))
        legend(d, IX + 20, IY + 560, [(RED, 'TRACKER / AD COMPANY'), (ORANGE, 'COMPANY SERVER ABROAD'), ((165, 165, 165), 'IN-COUNTRY')])
        return 'Illustrative animation of the Globe view. Country list from our test laptop: US 89, Canada 9, Ireland 4, Sweden 4, Netherlands 2, UK 1.'
    if name == 'COMPUTER':
        img.paste(SHOT_COMP, (IX, IY)); d = ImageDraw.Draw(img)
        for pts, col in EDGE_CURVES:
            d.line(pts, fill=(30, 30, 30), width=1)
        for j, (pts, col) in enumerate(EDGE_CURVES):
            period = 0.55 + (j % 4) * 0.09
            head = ((t + j * 0.191) / period) % 1.0 * 1.45
            tail = head - 0.4
            k0, k1 = max(0, int(tail * 59)), min(59, int(head * 59))
            for k in range(k0, k1):
                b = (k - tail * 59) / (0.4 * 59)
                d.line([pts[k], pts[k + 1]], fill=fade(col, max(0.05, min(1, b))), width=2 if b > 0.7 else 1)
            if head <= 1:
                hx, hy = pts[min(59, int(head * 59))]
                d.ellipse([hx - 2.5, hy - 2.5, hx + 2.5, hy + 2.5], fill=WHITE)
        d.rectangle([IX + 900, IY + 560, IX + 1270, IY + 700], fill=(0, 0, 0), outline=(90, 90, 90))
        legend(d, IX + 915, IY + 575, [(CYAN, 'APP → APP'), (ORANGE, 'APP → COMPANY'), (RED, 'APP → TRACKER / AD')])
        return 'Illustrative animation over the real Computer view; on a real PC, Outbound draws only observed connections.'
    # dossier: click through entries, no zoom
    i = min(len(DOSS) - 1, int((t - st) / 0.272)); k, idx = DOSS[i]
    img.paste(SHOT_DOSS[k], (IX, IY)); d = ImageDraw.Draw(img)
    lt = (t - st) - i * 0.272
    tx, ty = to_inset(80, 334 + idx * 30.6 + 8)
    if i + 1 < len(DOSS):
        nx, ny = to_inset(80, 334 + DOSS[i + 1][1] * 30.6 + 8)
        u = ease((lt - 0.12) / 0.15); cx, cy = lerp(tx, nx, u), lerp(ty, ny, u)
    else: cx, cy = tx, ty
    draw_cursor(d, cx, cy, max(0, 1 - lt / 0.12))
    return 'Real Outbound Dossier screens: 334 apps, 244 incidents, 575 sources, each fetched and verified.'

def scene_auth0(img, d, t):
    st = 34.92
    d.text((80, 112), 'AUTH0 CONSENT FIREWALL · CIBA + FGA', font=mono(22), fill=GREY)
    d.text((78, 140), 'NOTHING GETS BLOCKED UNTIL YOU SAY SO', font=bahn(76), fill=WHITE)
    para(d, 80, 232, 'Outbound asks Auth0 before it touches your firewall. Auth0 CIBA sends a push to YOUR phone, '
         'Auth0 FGA records who approved which rule, and only then does the enforcer plan the Windows Firewall rule. '
         'No Auth0 account? It runs locally, in dry-run mode.', semi(30), 1500, GREY, 34)
    steps = [('01', 'RULE ASKED', 'you click Block on an app'), ('02', 'PHONE PUSH', 'Auth0 CIBA asks you'),
             ('03', 'FGA TUPLE', 'Auth0 FGA records consent'), ('04', 'FIREWALL', 'Windows rule planned')]
    for j, (n, h, s) in enumerate(steps):
        s2 = st + j * P * 0.75; on = t >= s2
        x0 = 80 + j * 445; a = ease((t - s2) / 0.1) if on else 0.25
        d.rectangle([x0, 360, x0 + 400, 560], outline=fade(WHITE, a), width=3 if on else 1)
        d.text((x0 + 22, 374), n, font=mono(24, True), fill=fade(ORANGE, a))
        d.text((x0 + 22, 404), h, font=bahn(64), fill=fade(WHITE, a))
        d.text((x0 + 22, 500), s, font=mono(21), fill=fade(GREY, a))
        if j < 3: d.text((x0 + 404, 440), '→', font=mono(40, True), fill=fade(WHITE, a))
    # graphic: laptop -> Auth0 -> phone -> FGA -> firewall, with a request packet travelling the path
    ny = 790
    nodes = [(220, 'OUTBOUND', 'laptop'), (620, 'AUTH0', 'shield'), (1000, 'YOUR PHONE', 'phone'), (1380, 'AUTH0 FGA', 'tuple'), (1740, 'FIREWALL', 'wall')]
    d.line([(nodes[0][0], ny), (nodes[-1][0], ny)], fill=(60, 60, 60), width=3)
    u = ease_io((t - st) / 1.45); px = lerp(nodes[0][0], nodes[-1][0], u)
    d.line([(nodes[0][0], ny), (px, ny)], fill=ORANGE, width=4)
    for k in range(5):
        qx = px - k * 26
        if qx > nodes[0][0]: d.ellipse([qx - 7 + k, ny - 7 + k, qx + 7 - k, ny + 7 - k], fill=fade(WHITE, 1 - k * 0.18))
    for x, label, kind in nodes:
        lit = px >= x - 5; c = WHITE if lit else (80, 80, 80)
        if kind == 'laptop':
            d.rectangle([x - 70, ny - 60, x + 70, ny + 20], fill=(0, 0, 0), outline=c, width=3); d.line([(x - 95, ny + 30), (x + 95, ny + 30)], fill=c, width=4)
            d.text((x - 58, ny - 48), 'BLOCK TIKTOK?', font=mono(16, True), fill=c)
        elif kind == 'shield':
            d.polygon([(x - 55, ny - 70), (x + 55, ny - 70), (x + 55, ny - 10), (x, ny + 40), (x - 55, ny - 10)], fill=(0, 0, 0), outline=c, width=3)
            text_c(d, x, ny - 52, 'CIBA', bahn(40), c)
        elif kind == 'phone':
            d.rounded_rectangle([x - 60, ny - 110, x + 60, ny + 60], radius=16, fill=(0, 0, 0), outline=c, width=3)
            d.rectangle([x - 48, ny - 80, x + 48, ny - 10], outline=c, width=1)
            text_c(d, x, ny - 76, 'PUSH', mono(15, True), c); text_c(d, x, ny - 58, 'Block', mono(15), c); text_c(d, x, ny - 40, 'TikTok?', mono(15), c)
            d.rectangle([x - 46, ny + 2, x - 4, ny + 26], fill=(120, 120, 120) if lit else (0, 0, 0), outline=c); text_c(d, x - 25, ny + 5, 'YES', mono(15, True), WHITE if lit else c)
            d.rectangle([x + 4, ny + 2, x + 46, ny + 26], outline=c); text_c(d, x + 25, ny + 5, 'NO', mono(15, True), c)
        elif kind == 'tuple':
            d.rectangle([x - 130, ny - 60, x + 130, ny + 20], fill=(0, 0, 0), outline=c, width=3)
            text_c(d, x, ny - 50, 'user:you', mono(18, True), c); text_c(d, x, ny - 28, '#approver', mono(18), ORANGE if lit else c)
            text_c(d, x, ny - 6, '@rule:block-tiktok', mono(18), c)
        else:
            d.rectangle([x - 92, ny - 64, x + 110, ny + 24], fill=(0, 0, 0))
            for r_ in range(3):
                for b_ in range(4):
                    off = 18 if r_ % 2 else 0
                    d.rectangle([x - 80 + b_ * 40 + off - 9, ny - 60 + r_ * 28, x - 80 + b_ * 40 + off + 27, ny - 36 + r_ * 28], outline=RED if lit else c, width=2)
        text_c(d, x, ny + 72, label, mono(20, True), c)
    d.text((80, 960), 'Hosted Auth0 approval needs an enrolled phone; enforcement is a dry run unless you opt in.', font=mono(18), fill=DIM)

def render(t):
    img = Image.new('RGB', (W, H), (0, 0, 0)); d = ImageDraw.Draw(img)
    punch = 0.0; flash = 0.0
    def hit(ts, p=0.05, fl=0.22):
        nonlocal punch, flash
        for s in ts:
            if s <= t < s + 0.2:
                x = (t - s) / 0.2; punch = max(punch, p * (1 - x) ** 2); flash = max(flash, fl * (1 - x) ** 3)
    if t < 3.04:
        hit([0.78, 2.06], 0.02, 0.08)
        if t < 2.06:
            draw_banner(d, 960, 470 if t >= 1.04 else 540, 46, t)
            if t >= 1.04:
                s = '[ where your data goes, and who gets it ]'; n = int(len(s) * ease((t - 1.04) / 0.5))
                f = mono(30); bw = tw(f, s) + 60
                d.rectangle([960 - bw / 2, 640, 960 + bw / 2, 700], outline=GREY, width=2)
                d.text((960 - tw(f, s) / 2, 652), s[:n], font=f, fill=WHITE)
        else:
            text_c(d, 960, 300, 'OUTBOUND_', mono(44, True), GREY)
            a = ease((t - 2.06) / 0.25)
            text_c(d, 960, 400 + (1 - a) * 30, 'YOU WILL BE', bahn(150), fade(WHITE, a))
            text_c(d, 960, 560 + (1 - a) * 30, 'SECURE.', bahn(210), fade(WHITE, a))
    elif t < 4.08:
        hit([3.04], 0.10, 0.6); hit([3.60], 0.08, 0.35)
        text_c(d, 960, 250, 'WHY?', bahn(460 if t < 3.60 else 520), WHITE)
    elif t < 5.64:
        hit([4.08], 0.08, 0.5)
        a = 1 - ease((t - 5.2) / 0.35)
        text_c(d, 960, 720, 'YOU ARE BEING', bahn(110), fade(WHITE, a))
        text_c(d, 960, 830, 'MONITORED', bahn(170), fade(WHITE, a))
    elif t < 11.86:
        img.paste(grid); d = ImageDraw.Draw(img)
        idx = max(i for i, c in enumerate(CARDS) if t >= c['t'])
        hit([c['t'] for c in CARDS], 0.05, 0.3); hit([c['t'] + k * P for c in CARDS for k in (1, 2)], 0.012, 0.05)
        scene_card(img, d, t, CARDS[idx])
    elif t < 13.94:
        img.paste(grid); d = ImageDraw.Draw(img); hit([11.86], 0.06, 0.35)
        pts = [slot_pos(i, t) for i in range(N2)]
        packets(d, [(960, 470)] * N2, pts, t, WHITE, 1.0, 1.1, 2, 4, (48, 48, 48))
        floating2(img, d, t); d = ImageDraw.Draw(img)
        d.rectangle([700, 340, 1220, 760], fill=(0, 0, 0))
        text_c(d, 960, 330, 'YOU', bahn(260), WHITE)
        for i, (s, w_) in enumerate([(12.02, 'ARE LESS VALUABLE'), (12.2, 'THAN THE DATA'), (12.38, 'YOU PRODUCE.')]):
            if t >= s: text_c(d, 960, 610 + i * 62, w_, bahn(60), fade(WHITE, ease((t - s) / 0.08)))
        hud(d, 'THE PRODUCT IS YOU', '05 / 14', 'Logos: the apps most of us carry. Packets are an illustration.', right=None)
    elif t < 22.22:
        img.paste(grid); d = ImageDraw.Draw(img)
        cur = max((u for u in USES if t >= u[0]), key=lambda u: u[0])
        hit([u[0] for u in USES], 0.05, 0.3)
        pts = [slot_pos(i, t) for i in range(N2)]
        if cur[1] == 'D':
            n = int(N2 * ease((t - 20.04) / 1.2))
            packets(d, pts[:n], [pts[(i + 5) % N2] for i in range(n)], t, WHITE, 0.9, 0.8, 2, 4)
        floating2(img, d, t, 0.9); d = ImageDraw.Draw(img)
        scene_use(img, d, t, cur)
        hud(d, 'WHAT THEY DO WITH IT', f"{6 + 'ABCD'.index(cur[1]):02d} / 14", 'Quotes are verbatim from the linked publications, shortened with no change in meaning.')
    elif t < 28.46:
        img.paste(grid); d = ImageDraw.Draw(img)
        cur = max(STATS, key=lambda s: s[0] if t >= s[0] else -1); hit([s[0] for s in STATS], 0.05, 0.3)
        pts = [slot_pos(i, t) for i in range(N2)]
        packets(d, pts, [pts[(i + 3) % N2] for i in range(N2)], t, WHITE, 0.7, 0.9, 2, 4)
        floating2(img, d, t); d = ImageDraw.Draw(img)
        a = ease((t - cur[0]) / 0.3); num = cur[1]
        if '/' not in num: num = str(int(int(num) * a))
        d.rectangle([380, 330, 1540, 770], fill=(0, 0, 0), outline=(110, 110, 110), width=2)
        d.text((400, 340), '[ THEY ARE LOOKING AT US ]', font=mono(22, True), fill=GREY)
        text_c(d, 960, 380, num, bahn(260), WHITE)
        text_c(d, 960, 660, cur[2], bahn(52, 'SemiBold Condensed'), WHITE)
        hud(d, 'MEASURED ON ONE LAPTOP', f"{10 + STATS.index(cur):02d} / 14",
            "Outbound's opt-in scan of our own test laptop: domains only, no cookie values, no passwords.", right=None)
    elif t < 30.08:
        hit([28.46], 0.06, 0.35)
        text_c(d, 960, 260, 'HOW DO YOU', bahn(130), WHITE)
        if t >= 28.75: hit([28.75], 0.03, 0.15); text_c(d, 960, 400, 'PROTECT', bahn(200), fade(WHITE, ease((t - 28.75) / 0.08)))
        if t >= 29.05: hit([29.05], 0.03, 0.15); text_c(d, 960, 600, 'YOURSELF?', bahn(200), fade(WHITE, ease((t - 29.05) / 0.08)))
    elif t < 31.50:
        hit([30.08], 0.10, 0.6)
        draw_banner(d, 960, 470, 54, 10)
        text_c(d, 960, 640, 'SEE WHERE YOUR DATA GOES. THEN STOP IT.', bahn(64, 'SemiBold Condensed'), WHITE)
        text_c(d, 960, 730, 'LOCAL · OPEN SOURCE · AUTH0 CONSENT FIREWALL', mono(26), GREY)
    elif t < 34.92:
        img.paste(grid); d = ImageDraw.Draw(img)
        cur = max((f for f in FEATURES if t >= f[0]), key=lambda f: f[0]); hit([f[0] for f in FEATURES], 0.05, 0.3)
        note = scene_feature(img, d, t, cur); d = ImageDraw.Draw(img)
        frame_inset(d)
        hud(d, 'PROTECT YOURSELF', f"{12 + FEATURES.index(cur)} / 14", note, right=None)
    elif t < 36.9:
        img.paste(grid); d = ImageDraw.Draw(img); hit([34.92], 0.05, 0.3)
        scene_auth0(img, d, min(t, 36.5))
        hud(d, 'PROTECT YOURSELF', '14 / 14', 'Auth0 Client-Initiated Backchannel Authentication (CIBA) + Auth0 Fine-Grained Authorization (FGA).', right=None)
        if t >= 36.5: img = Image.fromarray((np.asarray(img) * (1 - ease((t - 36.5) / 0.4))).astype(np.uint8))
    if 5.64 <= t < 28.46:
        k = (t - B0) / P; ph = k - math.floor(k)
        if ph < 0.25:
            punch = max(punch, 0.016 * (1 - ph / 0.25) ** 2); flash = max(flash, 0.07 * (1 - ph / 0.25) ** 3)
        for g in GLITCH:
            if g <= t < g + 0.1: img = slice_glitch(img, t, g)
    es = eye_state(t)
    if es:
        cx, cy, w, o, al, glow = es
        lx, ly = gaze(t)
        if t >= 38.2: lx, ly = lx * 0.35, ly * 0.35
        if 4.08 <= t < 5.18: lx, ly = lx * 0.5, ly * 0.4
        draw_eye(img, cx, cy, w, o, lx, ly, al, glow)
    if punch > 0.001:
        s = 1 + punch; cw, ch = W / s, H / s
        img = img.crop((int((W - cw) / 2), int((H - ch) / 2), int((W + cw) / 2), int((H + ch) / 2))).resize((W, H), Image.BILINEAR)
    if flash > 0.01:
        arr = np.asarray(img).astype(np.float32); arr += (255 - arr) * flash; img = Image.fromarray(arr.astype(np.uint8))
    if t > 40.22:
        img = Image.fromarray((np.asarray(img) * (1 - ease((t - 40.22) / 0.38))).astype(np.uint8))
    return img

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'stills':
        for s in sys.argv[2:]: render(float(s)).save(f'v3_{s}.png')
        sys.exit()
    n = int(DUR * FPS)
    cmd = [FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', 'ref.mp4', '-map', '0:v', '-map', '1:a', '-t', str(DUR), '-af', f'afade=t=out:st={DUR - 0.35}:d=0.35',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
           '-movflags', '+faststart', 'outbound-promo-v3.mp4']
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        p.stdin.write(render(i / FPS).tobytes())
        if i % 150 == 0: print('frame', i, '/', n, flush=True)
    p.stdin.close(); p.wait(); print('done', p.returncode)
