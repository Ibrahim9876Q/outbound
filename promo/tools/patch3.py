import sys
p = 'render3.py'
s = open(p, encoding='utf-8').read()

def rep(a, b, count=1):
    global s
    n = s.count(a)
    if n < 1: sys.exit('MISSING: ' + a[:80])
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# 1. monochrome palette everywhere
rep("RED, ORANGE, CYAN = (255, 64, 64), (255, 150, 40), (80, 200, 255)",
    "RED, ORANGE, CYAN = (255, 255, 255), (205, 205, 205), (150, 150, 150)   # monochrome edit")
rep("    return c if sum(c) > 170 else (210, 210, 210)", "    return (150, 150, 150)")
rep("(255, 200, 120)", "(165, 165, 165)", 0)
rep("col = np.array(c if c else (200, 200, 200)) * shade", "col = np.array(c if c else (92, 92, 92)) * shade")
rep("fill=(0, 140, 70) if lit else None", "fill=(120, 120, 120) if lit else (0, 0, 0)")

# 2. company cards: square logos, much smaller collection chips
rep("draw_logo(img, d, s, x + 50 + i * 82, 205, 34, 1, 'c')", "draw_logo(img, d, s, x + 50 + i * 82, 205, 34, 1, 's')")
rep("semi(29), (130, 130, 130)) + 14", "semi(20), (120, 120, 120), gap=7, pad=9) + 8")
rep("semi(32), (130, 130, 130)) + 22", "semi(21), (120, 120, 120), gap=7, pad=9) + 14")
rep("semi(32), RED) + 22", "semi(21), RED, gap=7, pad=9) + 14")

# 3. Auth0 graphic: nodes get solid fills so the travelling line passes behind them
rep("d.rectangle([x - 70, ny - 60, x + 70, ny + 20], outline=c, width=3)", "d.rectangle([x - 70, ny - 60, x + 70, ny + 20], fill=(0, 0, 0), outline=c, width=3)")
rep("(x, ny + 40), (x - 55, ny - 10)], outline=c, width=3)", "(x, ny + 40), (x - 55, ny - 10)], fill=(0, 0, 0), outline=c, width=3)")
rep("d.rounded_rectangle([x - 60, ny - 110, x + 60, ny + 60], radius=16, outline=c, width=3)", "d.rounded_rectangle([x - 60, ny - 110, x + 60, ny + 60], radius=16, fill=(0, 0, 0), outline=c, width=3)")
rep("d.rectangle([x - 130, ny - 60, x + 130, ny + 20], outline=c, width=3)", "d.rectangle([x - 130, ny - 60, x + 130, ny + 20], fill=(0, 0, 0), outline=c, width=3)")
rep("        else:\n            for r_ in range(3):", "        else:\n            d.rectangle([x - 92, ny - 64, x + 110, ny + 24], fill=(0, 0, 0))\n            for r_ in range(3):")

# 4. computer view: thin monochrome shooting stars with fading gradient tails
rep("for u in np.linspace(0, 1, 24)]", "for u in np.linspace(0, 1, 60)]")
rep("""        for pts, col in EDGE_CURVES:
            d.line(pts, fill=fade(col, 0.55), width=2)
        for j, (pts, col) in enumerate(EDGE_CURVES):
            for k in range(3):
                u = (t * 1.9 + j * 0.173 + k / 3) % 1; px, py = pts[int(u * 23)]
                d.ellipse([px - 7, py - 7, px + 7, py + 7], fill=fade(col, 0.35))
                d.ellipse([px - 3.5, py - 3.5, px + 3.5, py + 3.5], fill=WHITE)""",
"""        for pts, col in EDGE_CURVES:
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
                d.ellipse([hx - 2.5, hy - 2.5, hx + 2.5, hy + 2.5], fill=WHITE)""")

# 5. middle section back to the first cut's style: ~22 floating square logos, monochrome
rep("def packets(d, pts_from,", '''SLOTS2 = [(150, 165), (400, 150), (650, 165), (900, 150), (1150, 165), (1400, 150),
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

def packets(d, pts_from,''')

rep('''def scene_use(img, d, t, cur):
    st, tag, head, pts = cur''', '''def scene_use(img, d, t, cur):
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
        d.text((x - 4, y + 26), '\\u201c', font=bahn(80), fill=fade(GREY, b))
        yy = para(d, x + 30, y + 48, q + '\\u201d', semi(38), colw - 50, fade(WHITE, b), 42)
        d.line([(x + 30, yy + 10), (x + 80, yy + 10)], fill=fade(GREY, b), width=2)
        para(d, x + 30, yy + 20, src, mono(17), colw - 50, fade(GREY, b), 21)
    return
''')

rep('''        pts = [field_pos(i, t) for i in range(len(FIELD))]
        packets(d, [(960, 480)] * len(pts), pts, t, WHITE, 0.9, 1.3, 2, 3, (40, 40, 40))
        draw_field(img, d, t, 0.9, (640, 300, 1280, 800)); d = ImageDraw.Draw(img)
        d.rectangle([640, 300, 1280, 800], fill=(0, 0, 0), outline=(90, 90, 90), width=2)
        text_c(d, 960, 300, 'YOU', bahn(250), WHITE)
        for i, (s, w_) in enumerate([(12.02, 'ARE LESS VALUABLE'), (12.2, 'THAN THE DATA'), (12.38, 'YOU PRODUCE.')]):
            if t >= s: text_c(d, 960, 580 + i * 68, w_, bahn(66), fade(WHITE, ease((t - s) / 0.08)))''',
'''        pts = [slot_pos(i, t) for i in range(N2)]
        packets(d, [(960, 470)] * N2, pts, t, WHITE, 1.0, 1.1, 2, 4, (48, 48, 48))
        floating2(img, d, t); d = ImageDraw.Draw(img)
        d.rectangle([700, 340, 1220, 760], fill=(0, 0, 0))
        text_c(d, 960, 330, 'YOU', bahn(260), WHITE)
        for i, (s, w_) in enumerate([(12.02, 'ARE LESS VALUABLE'), (12.2, 'THAN THE DATA'), (12.38, 'YOU PRODUCE.')]):
            if t >= s: text_c(d, 960, 610 + i * 62, w_, bahn(60), fade(WHITE, ease((t - s) / 0.08)))''')

rep('''        draw_field(img, d, t, 0.75); d = ImageDraw.Draw(img)
        if cur[1] == 'D':
            pts = [field_pos(i, t) for i in range(len(FIELD))]
            packets(d, pts, [pts[(i + 7) % len(pts)] for i in range(len(pts))], t, ORANGE, 0.9, 1.2, 2, 4, (70, 40, 10))''',
'''        pts = [slot_pos(i, t) for i in range(N2)]
        if cur[1] == 'D':
            n = int(N2 * ease((t - 20.04) / 1.2))
            packets(d, pts[:n], [pts[(i + 5) % N2] for i in range(n)], t, WHITE, 0.9, 0.8, 2, 4)
        floating2(img, d, t, 0.9); d = ImageDraw.Draw(img)''')

rep('''        pts = [field_pos(i, t) for i in range(len(FIELD))]
        packets(d, pts, [pts[(i + 5) % len(pts)] for i in range(len(pts))], t, WHITE, 0.8, 1.1, 1, 3, (36, 36, 36))
        draw_field(img, d, t, 0.95, (380, 330, 1540, 770)); d = ImageDraw.Draw(img)''',
'''        pts = [slot_pos(i, t) for i in range(N2)]
        packets(d, pts, [pts[(i + 3) % N2] for i in range(N2)], t, WHITE, 0.7, 0.9, 2, 4)
        floating2(img, d, t); d = ImageDraw.Draw(img)''')

# 6. faster pacing in the middle: beat punches, flashes, slice glitches, invert frames on the drops
rep('''    es = eye_state(t)
    if es:''', '''    if 5.64 <= t < 28.46:
        k = (t - B0) / P; ph = k - math.floor(k)
        if ph < 0.25:
            punch = max(punch, 0.016 * (1 - ph / 0.25) ** 2); flash = max(flash, 0.07 * (1 - ph / 0.25) ** 3)
        for g in GLITCH:
            if g <= t < g + 0.1: img = slice_glitch(img, t, g)
    es = eye_state(t)
    if es:''')

rep("render(float(s)).save(f'v2_{s}.png')", "render(float(s)).save(f'v3_{s}.png')")
rep("'outbound-promo-v2.mp4'", "'outbound-promo-v3.mp4'")
open(p, 'w', encoding='utf-8').write(s)
print('patched')
