# Outbound promo renderer: black, monochrome, beat-synced. Frames are piped to ffmpeg.
import math, random, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1920, 1080, 30
DUR = 40.6
FF = r"C:\Users\Ibrah\AppData\Local\Programs\Python\Python314\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe"
SHOTS = 'shots/'
B0, P = 3.07, 0.5139            # first drop and beat period measured from the track
def beat(k): return B0 + P * k

WHITE, GREY, DIM, FAINT = (255, 255, 255), (150, 150, 150), (85, 85, 85), (22, 22, 22)

# ---------- fonts ----------
_fc = {}
def bahn(size, style='Bold Condensed'):
    key = ('b', size, style)
    if key not in _fc:
        f = ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf', size); f.set_variation_by_name(style); _fc[key] = f
    return _fc[key]
def mono(size, bold=False):
    key = ('m', size, bold)
    if key not in _fc:
        _fc[key] = ImageFont.truetype('C:/Windows/Fonts/consolab.ttf' if bold else 'C:/Windows/Fonts/consola.ttf', size)
    return _fc[key]

def ease(x): x = min(1, max(0, x)); return 1 - (1 - x) ** 3
def ease_io(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def lerp(a, b, x): return a + (b - a) * x
def tw(font, s): return font.getlength(s)

def text_c(d, cx, y, s, font, fill=WHITE):
    d.text((cx - tw(font, s) / 2, y), s, font=font, fill=fill)

def wrap(s, font, maxw):
    out, line = [], ''
    for w in s.split():
        t = (line + ' ' + w).strip()
        if tw(font, t) > maxw and line: out.append(line); line = w
        else: line = t
    if line: out.append(line)
    return out

def fade(c, a): return tuple(int(v * a) for v in c)

# ---------- static layers ----------
grid = Image.new('RGB', (W, H), (0, 0, 0)); gd = ImageDraw.Draw(grid)
for x in range(0, W, 60): gd.line([(x, 0), (x, H)], fill=(13, 13, 13))
for y in range(0, H, 60): gd.line([(0, y), (W, y)], fill=(13, 13, 13))

BANNER = [r"  ___  _   _ _____ ____   ___  _   _ _   _ ____  ",
          r" / _ \| | | |_   _| __ ) / _ \| | | | \ | |  _ \ ",
          r"| | | | | | | | | |  _ \| | | | | | |  \| | | | |",
          r"| |_| | |_| | | | | |_) | |_| | |_| | |\  | |_| |",
          r" \___/ \___/  |_| |____/ \___/ \___/|_| \_|____/ "]
rng = random.Random(7)
reveal = [[rng.uniform(0.0, 0.62) for _ in row] for row in BANNER]
GLYPHS = '#@$%&*+=-:/\\|_<>'

def draw_banner(d, cx, cy, size, t, fill=WHITE):
    f = mono(size, True); cw = tw(f, 'M'); lh = size * 1.02
    x0 = cx - cw * len(BANNER[0]) / 2; y0 = cy - lh * len(BANNER) / 2
    for r, row in enumerate(BANNER):
        for c, ch in enumerate(row):
            if ch == ' ': continue
            rt = reveal[r][c]
            if t >= rt: g, col = ch, fill
            elif t >= rt - 0.3: g, col = GLYPHS[int((t * 40 + r * 7 + c) % len(GLYPHS))], DIM
            else: continue
            d.text((x0 + c * cw, y0 + r * lh), g, font=f, fill=col)

# ---------- the eye ----------
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
    if openv < 0.3:   # lashes on the closed lid
        k = 1 - openv / 0.3
        for x in (-0.6, -0.35, -0.1, 0.15, 0.4, 0.62):
            i = int((x + 1) / 2 * (len(xs) - 1)); px, py = lo[i]
            d.line([(px, py), (px + x * hw * 0.06, py + hh * 0.32 * k)], fill=255, width=lw)
    L = L.resize((pw, ph), Image.LANCZOS)
    if alpha < 1: L = L.point(lambda v: int(v * alpha))
    box = (int(cx - pw / 2), int(cy - ph / 2))
    if glow:
        g = L.filter(ImageFilter.GaussianBlur(w * 0.03)).point(lambda v: int(v * 0.55))
        img.paste(WHITE, box, g)
    img.paste(WHITE, box, L)

# eye gaze: quick saccades on beats, small drift in between
gr = random.Random(3)
gaze_pts = [(gr.uniform(-1, 1), gr.uniform(-0.9, 0.9)) for _ in range(400)]
def gaze(t):
    k = max(0, int((t - B0) / P)); tk = beat(k)
    a, b = gaze_pts[k % 400], gaze_pts[(k + 1) % 400]
    x = ease((t - tk) / 0.12)
    prev = gaze_pts[(k - 1) % 400]
    gx, gy = lerp(prev[0], a[0], x), lerp(prev[1], a[1], x)
    return gx + 0.05 * math.sin(t * 7), gy + 0.05 * math.cos(t * 5)

BLINKS = [13.94, 22.22, 28.46, 33.56]
def blink(t):
    for b in BLINKS:
        if b <= t < b + 0.18: return abs((t - b) / 0.09 - 1)
    return 1.0

CORNER = (1792, 84, 190)
def eye_state(t):
    """returns (cx, cy, w, open, alpha, glow) or None"""
    if t < 4.08: return None
    if t < 5.18:
        o = ease((t - 4.08) / 0.35)
        return (960, 400, 560, o * blink(t), 1, True)
    if t < 5.62:
        x = ease_io((t - 5.18) / 0.44)
        return (lerp(960, CORNER[0], x), lerp(400, CORNER[1], x), lerp(560, CORNER[2], x), 1, 1, x < 0.5)
    if t < 36.5: return (*CORNER, blink(t), 1, False)
    if t < 38.2:
        x = ease_io((t - 36.5) / 1.7)
        return (lerp(CORNER[0], 960, x), lerp(CORNER[1], 540, x), lerp(CORNER[2], 1000, x), 1, 1, x > 0.4)
    if t < 39.26: return (960, 540, 1000, 1, 1, True)
    x = ease_io((t - 39.26) / 0.96)
    return (960, 540, 1000, 1 - x, 1, True)

# ---------- HUD (reference-style chrome) ----------
def hud(d, section, count, source, a=1.0):
    d.text((60, 46), 'OUTBOUND_', font=mono(24, True), fill=fade(WHITE, a))
    d.text((210, 49), '// ' + section, font=mono(20), fill=fade(GREY, a))
    d.text((1560, 49), count, font=mono(20), fill=fade(GREY, a))
    d.line([(60, 92), (1660, 92)], fill=fade((60, 60, 60), a), width=1)
    d.line([(60, 1012), (1860, 1012)], fill=fade((60, 60, 60), a), width=1)
    d.text((60, 1024), source, font=mono(17), fill=fade(DIM, a))
    d.text((1860 - tw(mono(17), 'VERIFIED · OUTBOUND DOSSIER'), 1024), 'VERIFIED · OUTBOUND DOSSIER', font=mono(17), fill=fade(DIM, a))

# ---------- app icons ----------
APPS = [('IG', 'Instagram', 'c'), ('TT', 'TikTok', 's'), ('YT', 'YouTube', 's'), ('FB', 'Facebook', 'c'),
        ('SC', 'Snapchat', 's'), ('WA', 'WhatsApp', 'c'), ('G', 'Google', 'c'), ('CR', 'Chrome', 'c'),
        ('SP', 'Spotify', 'c'), ('DC', 'Discord', 's'), ('NF', 'Netflix', 's'), ('TH', 'Threads', 'c'),
        ('MS', 'Messenger', 'c'), ('AZ', 'Amazon', 's')]
SLOTS = [(170, 220), (470, 150), (800, 175), (1150, 160), (1450, 230), (1740, 420), (1700, 760),
         (1420, 900), (1060, 930), (700, 920), (360, 890), (150, 680), (130, 430), (1760, 600)]
def icon_pos(i, t):
    x, y = SLOTS[i]
    return x + 18 * math.sin(t * 0.9 + i * 1.7), y + 14 * math.cos(t * 0.7 + i * 2.3)
def draw_icon(d, i, t, a=1.0, pulse=0.0):
    ab, name, shape = APPS[i]; x, y = icon_pos(i, t); r = 46 * (1 + 0.12 * pulse)
    col = fade(WHITE, a)
    if shape == 'c': d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=3)
    else: d.rounded_rectangle([x - r, y - r, x + r, y + r], radius=18, outline=col, width=3)
    f = bahn(38); text_c(d, x, y - 24, ab, f, col)
    text_c(d, x, y + r + 8, name.upper(), mono(16), fade(GREY, a))
def beat_pulse(t):
    k = (t - B0) / P; return max(0, 1 - (k - math.floor(k)) / 0.35)

def packets(d, pts_from, pts_to, t, a=1.0, speed=1.1):
    for j, (p, q) in enumerate(zip(pts_from, pts_to)):
        d.line([p, q], fill=fade((48, 48, 48), a), width=1)
        for off in (0.0, 0.5):
            u = (t * speed + j * 0.137 + off) % 1
            x, y = lerp(p[0], q[0], u), lerp(p[1], q[1], u)
            d.rectangle([x - 4, y - 4, x + 4, y + 4], fill=fade(WHITE, a))

# ---------- scenes ----------
CARDS = [
    dict(t=beat(5), title='META', sub='INSTAGRAM · FACEBOOK · WHATSAPP', n='01',
         collect='What you do on other apps and websites, used to personalize ads.',
         items=[('€1.2B', '2023 · IRELAND', "Moved EU Facebook users' data to the US"),
                ('$5B', '2019 · U.S. FTC', 'Penalty for violating an earlier privacy order'),
                ('€405M', '2022 · IRELAND', "Instagram exposed children's contact details")],
         src='SOURCES: dataprotection.ie (2023, 2022) · ftc.gov (2019) · about.fb.com (2019)'),
    dict(t=beat(8), title='TIKTOK', sub='BYTEDANCE', n='02',
         collect='Approximate location when Location Services are on.',
         items=[('€530M', '2025 · IRELAND', "Transferred European users' data to China"),
                ('€345M', '2023 · IRELAND', "Children's default settings and age checks"),
                ('$5.7M', '2019 · U.S. FTC', "Musical.ly took kids' data without parental consent")],
         src='SOURCES: dataprotection.ie (2025, 2023) · ftc.gov (2019) · newsroom.tiktok.com'),
    dict(t=beat(11), title='GOOGLE', sub='YOUTUBE · CHROME · MAPS', n='03',
         collect='Videos you watch, your identifiers, device and interactions, to personalize content and ads.',
         items=[('$1.375B', '2025 · TEXAS', 'Claims over location, browsing and biometric data'),
                ('$391.5M', '2022 · MULTISTATE', 'Settlement over location tracking practices'),
                ('$170M', '2019 · U.S. FTC', "YouTube took kids' data without parental consent")],
         src='SOURCES: oag.state.tx.us (2025) · ag.ny.gov (2022) · ftc.gov (2019) · policies.google.com'),
    dict(t=beat(14), title='AND THE REST', sub='WHATSAPP · DISCORD · SNAPCHAT', n='04',
         collect='Discord: account and device information, and your IP address.',
         items=[('€225M', '2021 · IRELAND · WHATSAPP', "Didn't tell users clearly how their data was processed"),
                ('€800K', '2022 · FRANCE · DISCORD', "Sanctioned by France's privacy regulator, CNIL"),
                ('FTC', '2014 · U.S. · SNAPCHAT', 'Misleading claims about disappearing messages')],
         src='SOURCES: dataprotection.ie (2021) · cnil.fr (2022) · ftc.gov (2014) · discord.com/privacy'),
]

def scene_card(img, d, t, c, nxt):
    lt = t - c['t']
    d.line([(960, 150), (960, 990)], fill=(50, 50, 50), width=1)
    hud(d, 'WHO IS WATCHING', f"{c['n']} / 04", c['src'])
    d.text((80, 150), 'COMPANY ' + c['n'] + ' · ' + c['sub'], font=mono(22), fill=GREY)
    d.text((76, 178), c['title'], font=bahn(150), fill=WHITE)
    d.text((80, 400), '[ WHAT THEY COLLECT ]', font=mono(22, True), fill=GREY)
    for i, line in enumerate(wrap(c['collect'], bahn(52, 'SemiBold SemiCondensed'), 800)):
        d.text((80, 440 + i * 62), line, font=bahn(52, 'SemiBold SemiCondensed'), fill=WHITE)
    d.text((80, 900), 'THEIR OWN WORDS · PRIVACY POLICY', font=mono(18), fill=DIM)
    d.text((1010, 150), '[ WHAT THEY WERE CAUGHT FOR ]', font=mono(22, True), fill=GREY)
    for i, (amt, meta, desc) in enumerate(c['items']):
        st = c['t'] + i * P
        if t < st: continue
        a = ease((t - st) / 0.12); y = 200 + i * 265 + (1 - a) * 30
        d.text((1010, y), 'ABC'[i], font=mono(26, True), fill=fade(GREY, a))
        d.text((1050, y - 14), amt, font=bahn(108), fill=fade(WHITE, a))
        d.text((1052, y + 104), meta, font=mono(20), fill=fade(GREY, a))
        for j, line in enumerate(wrap(desc, bahn(38, 'SemiBold SemiCondensed'), 780)):
            d.text((1050, y + 136 + j * 42), line, font=bahn(38, 'SemiBold SemiCondensed'), fill=fade(WHITE, a))

USES = [
    (13.94, 'A', 'WHAT YOU DO IN OTHER APPS PERSONALIZES THEIR ADS', "SOURCE: Meta, Off-Facebook Activity announcement (2019) · about.fb.com"),
    (16.10, 'B', 'WHAT YOU WATCH FEEDS THE ALGORITHM THAT PICKS WHAT YOU SEE NEXT', 'SOURCE: Google Privacy Policy, YouTube watch history used to personalize recommendations'),
    (18.32, 'C', 'PURCHASES, LOCATION, CONTACTS, BROWSING HISTORY: LINKED TO YOU', "SOURCE: Threads (Instagram, Inc.) App Store privacy label, 'Data Linked to You'"),
    (20.04, 'D', 'AND THE APPS SHARE. SOME PARTNERS COULD EVEN READ MESSAGES', "SOURCE: Meta Newsroom, Facebook's messaging partners (Dec 2018) · about.fb.com"),
]
STATS = [
    (22.22, '104 / 497', 'SITES WE VISITED HAD TRACKERS WATCHING'),
    (24.36, '162', 'TRACKER COMPANIES SAW ONE LAPTOP BROWSE'),
    (26.44, '378', 'TRACKER COOKIE DOMAINS SITTING ON THE PC'),
]
FEATURES = [
    (31.50, 'globe', '01', 'SEE WHICH COUNTRY YOUR DATA LANDS IN', (40, 190, 1360, 932)),
    (32.58, 'computer', '02', 'EVERY APP. EVERY COMPANY IT TALKS TO. LIVE.', (120, 150, 1460, 904)),
    (33.56, 'dossier', '03', '330+ APPS · 240+ VERIFIED FINES, CASES & INVESTIGATIONS', (640, 160, 1920, 880)),
    (34.92, 'rules', '04', 'BLOCK IT. APPROVE IT FROM YOUR PHONE WITH AUTH0.', (0, 200, 1060, 796)),
]
shots = {k: Image.open(SHOTS + k + '-1920x1080.png').convert('RGB') for k in ('globe', 'computer', 'dossier', 'rules')}

def floating(d, t, a=1.0):
    p = beat_pulse(t)
    for i in range(len(APPS)): draw_icon(d, i, t, a, p if i % 3 == int((t - B0) / P) % 3 else 0)

def statement(d, t, st, tag, text, size=96, maxw=1180, y0=None):
    a = ease((t - st) / 0.15)
    f = bahn(size); lines = wrap(text, f, maxw); lh = size * 1.02
    y = (y0 if y0 is not None else 540 - lh * len(lines) / 2) + (1 - a) * 24
    bw = max(tw(f, l) for l in lines) + 120; bh = lh * len(lines) + 70
    d.rectangle([960 - bw / 2, y - 40, 960 + bw / 2, y - 40 + bh], fill=(0, 0, 0), outline=fade((110, 110, 110), a), width=2)
    d.text((960 - bw / 2 + 16, y - 34), '[' + tag + ']', font=mono(22, True), fill=fade(GREY, a))
    for i, l in enumerate(lines): text_c(d, 960, y + i * lh, l, f, fade(WHITE, a))

def render(t):
    img = Image.new('RGB', (W, H), (0, 0, 0)); d = ImageDraw.Draw(img)
    punch = 0.0; flash = 0.0
    def hit(ts, p=0.05, fl=0.22):
        nonlocal punch, flash
        for s in ts:
            if s <= t < s + 0.2:
                x = (t - s) / 0.2; punch = max(punch, p * (1 - x) ** 2); flash = max(flash, fl * (1 - x) ** 3)

    if t < 3.04:                                   # intro: logo, mini quote, slogan
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
    elif t < 4.08:                                 # WHY?
        hit([3.04], 0.10, 0.6); hit([3.60], 0.08, 0.35)
        text_c(d, 960, 250, 'WHY?', bahn(460 if t < 3.60 else 520), WHITE)
    elif t < 5.64:                                 # YOU ARE BEING MONITORED
        hit([4.08], 0.08, 0.5)
        a = 1 - ease((t - 5.2) / 0.35)
        text_c(d, 960, 720, 'YOU ARE BEING', bahn(110), fade(WHITE, a))
        text_c(d, 960, 830, 'MONITORED', bahn(170), fade(WHITE, a))
    elif t < 11.86:                                # company cards
        img.paste(grid); d = ImageDraw.Draw(img)
        idx = max(i for i, c in enumerate(CARDS) if t >= c['t'])
        hit([c['t'] for c in CARDS], 0.05, 0.3); hit([c['t'] + k * P for c in CARDS for k in (1, 2)], 0.015, 0.06)
        scene_card(img, d, t, CARDS[idx], None)
    elif t < 13.94:                                # YOU / less valuable
        img.paste(grid); d = ImageDraw.Draw(img); hit([11.86], 0.06, 0.35)
        floating(d, t); pts = [icon_pos(i, t) for i in range(len(APPS))]
        packets(d, [(960, 470)] * len(pts), pts, t)
        d.rectangle([700, 340, 1220, 760], fill=(0, 0, 0))
        text_c(d, 960, 330, 'YOU', bahn(260), WHITE)
        words = [(12.80, 'ARE LESS VALUABLE'), (13.14, 'THAN THE DATA'), (13.44, 'YOU PRODUCE.')]
        for i, (s, w) in enumerate(words):
            if t >= s:
                a = ease((t - s) / 0.1); text_c(d, 960, 610 + i * 62, w, bahn(60), fade(WHITE, a))
        hud(d, 'THE PRODUCT IS YOU', '05 / 16', 'Every app talks to someone. The packets above are an illustration.')
    elif t < 22.22:                                # what they do with it
        img.paste(grid); d = ImageDraw.Draw(img)
        cur = max(u for u in USES if t >= u[0])
        hit([u[0] for u in USES], 0.05, 0.3)
        floating(d, t, 0.9)
        if cur[1] == 'D':                          # apps linked to each other
            pts = [icon_pos(i, t) for i in range(len(APPS))]
            prog = ease((t - 20.04) / 1.2); n = int(len(pts) * prog)
            packets(d, pts[:n], [pts[(i + 5) % len(pts)] for i in range(n)], t, 0.9, 0.8)
            floating(d, t, 1)
        statement(d, t, cur[0], cur[1], cur[2], 92, 1150)
        hud(d, 'WHAT THEY DO WITH IT', f"{6 + 'ABCD'.index(cur[1]):02d} / 16", cur[3])
    elif t < 28.46:                                # measured on our laptop
        img.paste(grid); d = ImageDraw.Draw(img)
        cur = max(s for s in STATS if t >= s[0]); hit([s[0] for s in STATS], 0.05, 0.3)
        pts = [icon_pos(i, t) for i in range(len(APPS))]
        packets(d, pts, [pts[(i + 3) % len(pts)] for i in range(len(pts))], t, 0.7, 0.9)
        floating(d, t)
        a = ease((t - cur[0]) / 0.3)
        num = cur[1]
        if '/' not in num: num = str(int(int(num) * a))
        d.rectangle([380, 330, 1540, 770], fill=(0, 0, 0), outline=(110, 110, 110), width=2)
        d.text((400, 340), '[ THEY ARE LOOKING AT US ]', font=mono(22, True), fill=GREY)
        text_c(d, 960, 380, num, bahn(260), WHITE)
        text_c(d, 960, 660, cur[2], bahn(52, 'SemiBold Condensed'), WHITE)
        hud(d, 'MEASURED ON ONE LAPTOP', f"{10 + STATS.index(cur):02d} / 16",
            "Outbound's opt-in scan of our own test laptop: domains only, no cookie values, no passwords.")
    elif t < 30.08:                                # HOW DO YOU PROTECT YOURSELF?
        hit([28.46], 0.06, 0.35)
        if t >= 28.46: text_c(d, 960, 260, 'HOW DO YOU', bahn(130), WHITE)
        if t >= 29.50: hit([29.50], 0.03, 0.15); text_c(d, 960, 400, 'PROTECT', bahn(200), WHITE)
        if t >= 29.92: hit([29.92], 0.03, 0.15); text_c(d, 960, 600, 'YOURSELF?', bahn(200), WHITE)
    elif t < 31.50:                                # logo drop
        hit([30.08], 0.10, 0.6)
        draw_banner(d, 960, 470, 54, 10)
        text_c(d, 960, 640, 'SEE WHERE YOUR DATA GOES. THEN STOP IT.', bahn(64, 'SemiBold Condensed'), WHITE)
        text_c(d, 960, 730, 'LOCAL · OPEN SOURCE · AUTH0 CONSENT FIREWALL', mono(26), GREY)
    elif t < 35.64:                                # feature tour with real screenshots
        img.paste(grid); d = ImageDraw.Draw(img)
        cur = max(f for f in FEATURES if t >= f[0]); hit([f[0] for f in FEATURES], 0.05, 0.3)
        i = FEATURES.index(cur); end = FEATURES[i + 1][0] if i + 1 < len(FEATURES) else 35.64
        x = ease_io((t - cur[0]) / (end - cur[0]))
        fx0, fy0, fx1, fy1 = cur[4]
        box = (lerp(0, fx0, x * 0.85 + 0.15), lerp(0, fy0, x * 0.85 + 0.15),
               lerp(1920, fx1, x * 0.85 + 0.15), lerp(1080, fy1, x * 0.85 + 0.15))
        bw, bh = box[2] - box[0], box[3] - box[1]
        bh = bw * 9 / 16; box = (box[0], box[1], box[2], box[1] + bh)
        crop = shots[cur[1]].crop(tuple(int(v) for v in box)).resize((1280, 720), Image.LANCZOS)
        img.paste(crop, (320, 260)); d = ImageDraw.Draw(img)
        d.rectangle([318, 258, 1602, 982], outline=(140, 140, 140), width=2)
        for cx, cy, sx, sy in ((318, 258, 1, 1), (1602, 258, -1, 1), (318, 982, 1, -1), (1602, 982, -1, -1)):
            d.line([(cx, cy), (cx + 40 * sx, cy)], fill=WHITE, width=4); d.line([(cx, cy), (cx, cy + 40 * sy)], fill=WHITE, width=4)
        d.text((80, 130), 'FEATURE ' + cur[2] + ' · ' + cur[1].upper() + ' VIEW', font=mono(22), fill=GREY)
        d.text((78, 160), cur[3], font=bahn(76), fill=WHITE)
        hud(d, 'PROTECT YOURSELF', f"{12 + i:02d} / 16", 'Real Outbound screens. Everything runs on 127.0.0.1; nothing you do is sent off the PC.')
    elif t < 36.5:                                 # Auth0 consent firewall steps
        img.paste(grid); d = ImageDraw.Draw(img); hit([35.64], 0.05, 0.3)
        d.text((80, 130), 'AUTH0 CONSENT FIREWALL', font=mono(22), fill=GREY)
        d.text((78, 160), 'NOTHING GETS BLOCKED UNTIL YOU SAY SO', font=bahn(76), fill=WHITE)
        steps = [('01', 'RULE ASKED', 'dashboard sends the block'), ('02', 'PHONE PUSH', 'Auth0 CIBA asks you'),
                 ('03', 'FGA TUPLE', 'Auth0 FGA records consent'), ('04', 'FIREWALL', 'Windows rule planned')]
        for j, (n, h, s) in enumerate(steps):
            st = 35.64 + j * P * 0.5; on = t >= st
            x0 = 80 + j * 445; a = ease((t - st) / 0.1) if on else 0.25
            d.rectangle([x0, 420, x0 + 400, 700], outline=fade(WHITE, a), width=3 if on else 1)
            d.text((x0 + 24, 440), n, font=mono(26, True), fill=fade(GREY, a))
            d.text((x0 + 24, 490), h, font=bahn(70), fill=fade(WHITE, a))
            d.text((x0 + 24, 600), s, font=mono(22), fill=fade(GREY, a))
            if j < 3: d.text((x0 + 404, 530), '→', font=mono(40, True), fill=fade(WHITE, a))
        hud(d, 'PROTECT YOURSELF', '16 / 16', 'Auth0 CIBA + FGA. Firewall enforcement is a dry run unless you opt in.')
    # else: black, the eye carries the ending

    # content fade into the ending
    if 36.5 <= t < 37.0:
        pass
    es = eye_state(t)
    if es:
        cx, cy, w, o, al, glow = es
        lx, ly = gaze(t)
        if t >= 38.2: lx, ly = lx * 0.35, ly * 0.35
        if 4.08 <= t < 5.18: lx, ly = lx * 0.5, ly * 0.4
        draw_eye(img, cx, cy, w, o, lx, ly, al, glow)

    arr = None
    if punch > 0.001:
        s = 1 + punch; cw, ch = W / s, H / s
        img = img.crop((int((W - cw) / 2), int((H - ch) / 2), int((W + cw) / 2), int((H + ch) / 2))).resize((W, H), Image.BILINEAR)
    if flash > 0.01:
        arr = np.asarray(img).astype(np.float32); arr += (255 - arr) * flash; img = Image.fromarray(arr.astype(np.uint8))
    if 39.26 <= t:      # final fade of the closed eye
        k = 1 - ease((t - 40.22) / 0.38) if t > 40.22 else 1
        if k < 1: img = Image.fromarray((np.asarray(img) * k).astype(np.uint8))
    return img

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'stills':
        for s in sys.argv[2:]:
            render(float(s)).save(f'still_{s}.png')
        sys.exit()
    n = int(DUR * FPS)
    cmd = [FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', 'ref.mp4', '-map', '0:v', '-map', '1:a', '-t', str(DUR),
           '-af', f'afade=t=out:st={DUR - 0.35}:d=0.35',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
           '-movflags', '+faststart', 'outbound-promo.mp4']
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        p.stdin.write(render(i / FPS).tobytes())
        if i % 150 == 0: print('frame', i, '/', n, flush=True)
    p.stdin.close(); p.wait(); print('done', p.returncode)
