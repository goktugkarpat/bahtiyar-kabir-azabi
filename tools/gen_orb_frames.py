# KARA GEÇİT - orb frame art generator (offline; needs python3 + numpy + Pillow).
# Draws the health (orb-l) and stamina (orb-r) frames: a thin blackened riveted iron ring, etched sigils with ember light,
# a broken outer rim with chain links, a fissure at the top and a small keystone seal with a slit eye at the bottom.
# Layout contract (520 x 500 px, same as the CSS expects): the liquid canvas is centred at (280, 244) for orb-l and (240, 244) for orb-r,
# hole edge (50 % alpha) at radius 137 px, everything inside radius ~126 px is fully transparent. Ring outer radius ~165 px.
# Procedural orb frame art for KARA GEÇİT ("Kül Mührü": blackened iron ring, etched sigils, embers).
import numpy as np, math, sys, time
from PIL import Image, ImageDraw
F = np.float32
SS = int(sys.argv[1]) if len(sys.argv) > 1 else 4
W0, H0 = 520, 500
CY = 244.0
R_IN = 137.0          # hole edge (alpha 50 %)
R_OUT = 159.5        # main band outer edge (thin version)
R_RIM0, R_RIM1 = 160.9, 165.2   # broken outer rim
R_CLASP = 166.5      # clasp tabs

def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def blur(a, s):
    if s <= 0.01: return a
    fy = np.fft.fftfreq(a.shape[0])[:, None]; fx = np.fft.rfftfreq(a.shape[1])[None, :]
    g = np.exp(-2 * (np.pi * s) ** 2 * (fx ** 2 + fy ** 2))
    return np.fft.irfft2(np.fft.rfft2(a) * g, s=a.shape).astype(F)

def noise(rng, shape, cell):
    cell = max(2, int(round(cell)))
    gh, gw = int(shape[0] / cell) + 4, int(shape[1] / cell) + 4
    g = rng.random((gh, gw)).astype(F)
    im = Image.fromarray(g, mode='F').resize((gw * int(cell), gh * int(cell)), Image.BICUBIC)
    a = np.asarray(im)[:shape[0], :shape[1]]
    return a.astype(F)

def noise_aniso(rng, shape, cellx, celly):
    cx_, cy_ = max(2, int(cellx)), max(2, int(celly))
    gh, gw = int(shape[0] / cy_) + 4, int(shape[1] / cx_) + 4
    g = rng.random((gh, gw)).astype(F)
    im = Image.fromarray(g, mode='F').resize((gw * cx_, gh * cy_), Image.BICUBIC)
    return np.asarray(im)[:shape[0], :shape[1]].astype(F)

def fbm(rng, shape, cell0, octs=4, gain=.5):
    s = np.zeros(shape, F); amp = 1.; tot = 0.; cell = cell0
    for _ in range(octs):
        s += amp * noise(rng, shape, max(2, cell)); tot += amp; amp *= gain; cell /= 2
    return s / tot

def draw_mask(w, h, fn, scale):
    im = Image.new('L', (w, h), 0); d = ImageDraw.Draw(im); fn(d, scale); return np.asarray(im).astype(F) / 255.

# ---- glyph library (unit box, x right, y up; coordinates roughly in [-1,1]) ----
def glyph_strokes(k):
    C = lambda cx, cy, r, n=20: [('l', [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n + 1)])]
    A = lambda cx, cy, r, a0, a1, n=14: [('l', [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)])]
    L = lambda *p: [('l', list(p))]
    D = lambda x, y: [('d', (x, y))]
    G = {
     0: L((0, -1), (0, 1)) + C(0, .1, .42) + L((-.5, .9), (.5, .9)) + D(0, .1),
     1: L((0, -1), (0, .9)) + L((-.65, .75), (-.65, .05), (0, -.45), (.65, .05), (.65, .75)),
     2: L((-.6, -.85), (.6, -.85), (0, .5), (-.6, -.85)) + D(0, .88) + L((0, -.85), (0, -.15)),
     3: L((-.7, -.9), (.7, .9)) + L((.7, -.9), (-.7, .9)) + C(0, 0, .3) + L((-.7, .9), (-.7, .55)),
     4: A(0, 0, .62, 40, 320) + D(0, 0) + L((0, .62), (0, 1)),
     5: L((-.5, -1), (.5, -.55), (-.5, -.1), (.5, .35), (-.5, .8)) + L((.5, .8), (.5, 1)),
     6: L((-.55, -1), (-.55, 1)) + L((.55, -1), (.55, 1)) + L((-.55, -.5), (.55, -.2)) + L((-.55, .2), (.55, .5)),
     7: L((0, -1), (.6, 0), (0, 1), (-.6, 0), (0, -1)) + L((0, -.55), (0, .55)) + L((-.3, 0), (.3, 0)),
     8: C(0, 0, .75) + L((-.75, 0), (.75, 0)) + D(0, .4) + D(0, -.4),
     9: L((-.6, .9), (0, .3), (.6, .9)) + L((-.6, -.9), (0, -.3), (.6, -.9)) + L((0, -1), (0, 1)),
    }
    return G[k]

def build_unrolled(glyphs, TN=8192, r0=152., r1=182., ppu=8, lw_units=2.7):
    """glyphs: list of (angle_deg, glyph_id, half_height_units). Returns (rows x TN) mask, rows=(r1-r0)*ppu, row index v=(r-r0)*ppu."""
    rows = int((r1 - r0) * ppu)
    im = Image.new('L', (TN, rows), 0); d = ImageDraw.Draw(im)
    lw = int(lw_units * ppu)
    for ang, gid, hh in glyphs:
        cx = ang / 360. * TN; cyv = rows / 2
        sc = hh * ppu
        for kind, pts in glyph_strokes(gid):
            if kind == 'l':
                P = [(cx + x * sc * .78, cyv - y * sc) for x, y in pts]     # y up = radially outward is v larger -> flip below
                d.line(P, fill=255, width=lw, joint='curve')
                for (x, y) in (P[0], P[-1]): d.ellipse([x - lw / 2, y - lw / 2, x + lw / 2, y + lw / 2], fill=255)
            else:
                x, y = pts; x = cx + x * sc * .78; y = cyv - y * sc; rr = lw * .9
                d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=255)
    a = np.asarray(im).astype(F) / 255.
    a = blur(a, 2.2)
    return np.clip(a * 1.5, 0, 1)

def sample_unrolled(U, r, th, r0, ppu, TN):
    u = (th / (2 * np.pi) % 1.0) * TN; v = (r - r0) * ppu
    ok = (v >= 0) & (v <= U.shape[0] - 1.001)
    v = np.clip(v, 0, U.shape[0] - 1.001)
    u0 = np.floor(u).astype(int); fu = (u - u0).astype(F); u0 %= TN; u1 = (u0 + 1) % TN
    v0 = np.floor(v).astype(int); fv = (v - v0).astype(F)
    a = U[v0, u0] * (1 - fu) + U[v0, u1] * fu; b = U[v0 + 1, u0] * (1 - fu) + U[v0 + 1, u1] * fu
    return (a * (1 - fv) + b * fv) * ok

def rounded_poly_mask(pts, cx, cy, scale, shape, soft=0):
    im = Image.new('L', (shape[1], shape[0]), 0); d = ImageDraw.Draw(im)
    d.polygon([((cx + x) * scale, (cy + y) * scale) for x, y in pts], fill=255)
    a = np.asarray(im).astype(F) / 255.
    return blur(a, soft * scale) if soft else a


def poly_ring_points(cx, cy, a, b, ang, n=28):
    ca, sa = math.cos(ang), math.sin(ang)
    return [(cx + a * math.cos(2 * math.pi * i / n) * ca - b * math.sin(2 * math.pi * i / n) * sa,
             cy + a * math.cos(2 * math.pi * i / n) * sa + b * math.sin(2 * math.pi * i / n) * ca) for i in range(n + 1)]

def render(kind, seed):
    t0 = time.time()
    mir = (kind == 'stamina')
    CX = 240. if mir else 280.
    rng = np.random.default_rng(seed)
    Hh, Ww = H0 * SS, W0 * SS
    shape = (Hh, Ww)
    X = ((np.arange(Ww) + .5) / SS)[None, :].astype(F) * np.ones((Hh, 1), F)
    Y = ((np.arange(Hh) + .5) / SS)[:, None].astype(F) * np.ones((1, Ww), F)
    dx = (CX - X) if mir else (X - CX); dy = Y - CY
    ix, iy = X - CX, Y - CY
    r = np.hypot(dx, dy).astype(F)
    th = np.mod(np.arctan2(dx, -dy), 2 * np.pi).astype(F)          # 0 = top, clockwise (mirrored for stamina)
    def angdist(a0):
        d = th - math.radians(a0); return (d + np.pi) % (2 * np.pi) - np.pi
    def polar_pt(a_deg, rr):
        a = math.radians(a_deg); sgn = -1 if mir else 1
        return CX + sgn * rr * math.sin(a), CY - rr * math.cos(a)
    P = dict(health=dict(ember=(1.0, .17, .06), hot=(1.0, .50, .25), glow=(.85, .07, .03)),
             stamina=dict(ember=(1.0, .40, .06), hot=(1.0, .68, .30), glow=(.88, .28, .03)))[kind]
    ember = np.array(P['ember'], F); hot = np.array(P['hot'], F); glowc = np.array(P['glow'], F)

    TOPA = 5.0
    n_mid = fbm(rng, shape, 18 * SS, 4); n_hi = fbm(rng, shape, 4 * SS, 3)
    n_pit = noise(rng, shape, 1.6 * SS)
    rw = r + (n_mid - .5) * 1.1 + (n_hi - .5) * .6

    # circumferential streaks (turned-metal look) via unrolled anisotropic noise
    TN, ppu = 8192, 8
    r0u = 130.
    RU = int((190 - r0u) * ppu)
    st1 = noise_aniso(rng, (RU, TN), 260, 5); st2 = noise_aniso(rng, (RU, TN), 90, 2.2)
    streak = sample_unrolled(.6 * st1 + .4 * st2, r, th, r0u, ppu, TN)

    # ----- silhouette -----
    band = sstep(R_IN - .5 / SS, R_IN + .5 / SS, r) * (1 - sstep(R_OUT - .5 / SS, R_OUT + .5 / SS, rw))
    # the ring is split at the top: V notch cut from the outer edge inwards
    s_n = np.abs(angdist(TOPA)) * r + (n_hi - .5) * 1.2
    nw = .35 + np.maximum(0, r - 148) * .16
    notch = (1 - sstep(nw - .5, nw + .5, s_n)) * (r > 148)
    band = band * (1 - notch)
    RM = .5 * (R_RIM0 + R_RIM1)
    gaps = [(24, 6.0), (73, 6.5), (139, 7.5), (201, 6.0), (261, 7.5), (327, 5.5)]
    if mir: gaps = [(360 - g, w) for g, w in gaps]
    gapm = np.zeros(shape, F)
    for g0, gw in gaps:
        s_ = np.abs(angdist(g0)) * RM
        gapm = np.maximum(gapm, 1 - sstep(gw * .5 - .5, gw * .5 + .5, s_))
    # chips bitten out of the outer rim
    for a_deg, rr_, rad in [(35, 165.2, 3.6), (172, 165.6, 3.2), (236, 165.0, 3.4), (290, 165.6, 3.0), (105, 165.2, 3.2)]:
        px, py = polar_pt(a_deg, rr_); dd = np.hypot(X - px, Y - py) + (n_hi - .5) * 2.6
        gapm = np.maximum(gapm, 1 - sstep(rad - .6, rad + .6, dd))
    outer = sstep(R_RIM0 - .5, R_RIM0 + .5, rw) * (1 - sstep(R_RIM1 - .5 / SS, R_RIM1 + .5 / SS, rw)) * (1 - gapm) * (1 - notch)
    clasp_ang = [45, 135, 225, 315]
    clasp = np.zeros(shape, F)
    for a0 in clasp_ang:
        s_ = angdist(a0) * r
        hw = 8.4 - 1.6 * sstep(162, R_CLASP, r)
        m = sstep(-hw - .5, -hw + .5, s_) * (1 - sstep(hw - .5, hw + .5, s_)) * sstep(R_IN - .5, R_IN + .5, r) * (1 - sstep(R_CLASP - .5, R_CLASP + .5, rw))
        clasp = np.maximum(clasp, m)
    SEAL = [(0, 147), (15.5, 167), (12, 192), (0, 209), (-12, 192), (-15.5, 167)]
    seal_m = rounded_poly_mask(SEAL, CX, CY, SS, shape)
    # chain links binding two gaps
    chain_spec = []
    for gi_ in (1, 4):
        g0 = gaps[gi_][0]
        for j, off in enumerate((-1, 1)):
            a_c = g0 + off * (3.6 / RM * 180 / math.pi) * (1 if not mir else -1)
            px, py = polar_pt(a_c, RM)
            sgn = -1 if mir else 1
            tx, ty = math.cos(math.radians(g0)) * sgn, math.sin(math.radians(g0))
            chain_spec.append((px, py, math.atan2(ty, tx), j))
    imc = Image.new('L', (Ww, Hh), 0); dc = ImageDraw.Draw(imc)
    for (px, py, ang, j) in chain_spec:
        a_, b_ = (6.6, 3.5) if j == 0 else (6.6, 2.2)
        pts = [(x * SS, y * SS) for x, y in poly_ring_points(px, py, a_, b_, ang)]
        dc.line(pts, fill=255, width=int(2.0 * SS), joint='curve')
    chain = np.asarray(imc).astype(F) / 255.
    alpha_obj = np.clip(np.maximum.reduce([band, outer, clasp, seal_m, chain]), 0, 1)
    alpha_obj *= sstep(R_IN - .5 / SS, R_IN + .5 / SS, r)

    # ----- height -----
    bump = lambda x, c, w: np.exp(-((x - c) / w) ** 2)
    Hm = 4.2 * band + 3.4 * outer + 1.3 * clasp + 3.4 * chain
    Hm += 2.6 * bump(r, 139.4, 2.0) + 1.9 * bump(r, 158.3, 1.6) - 1.4 * bump(r, 145.0, .6) - 1.4 * bump(r, 159.6, .6) - 1.1 * bump(r, 160.3, .5) + .9 * bump(r, RM, 1.4) * outer
    wire = bump(r, 141.6, .6) * band
    Hm += 0.9 * wire
    # seams; the top one is the broken fissure
    seam = np.zeros(shape, F); top = np.zeros(shape, F)
    jag = (n_mid - .5) * 3.0 + (n_hi - .5) * 2.0
    for a0, w, dep in [(90, .9, 2.0), (180, .9, 2.0), (270, .9, 2.0)]:
        s_ = np.abs(angdist(a0)) * r + jag * .3
        m = (1 - sstep(w * .5, w * .5 + .5, s_)) * band * sstep(R_IN + 1.5, R_IN + 3, r)
        seam = np.maximum(seam, m); Hm -= dep * m
    s_top = np.abs(angdist(TOPA)) * r + jag * .6
    top = (1 - sstep(1.0, 1.7, s_top)) * band
    Hm -= 4.5 * top
    seam = np.maximum(seam, top)
    Hm += 4.0 * blur(clasp, 1.3 * SS) * clasp
    strap = np.zeros(shape, F)
    for a0 in clasp_ang:
        s_ = angdist(a0) * r
        strap = np.maximum(strap, (1 - sstep(.3, .85, np.abs(np.abs(s_) - 4.0))) * clasp * sstep(R_IN + 2, R_IN + 3, r) * (1 - sstep(R_CLASP - 4.5, R_CLASP - 3.5, r)))
    Hm -= 1.2 * strap
    Hm += 5.5 * blur(seal_m, 2.4 * SS) * seal_m
    Hm += 2.6 * blur(chain, .7 * SS) * chain
    Hm += (n_mid - .5) * .8 + (n_hi - .5) * .5 + (streak - .5) * .45 - 1.2 * sstep(.89, .95, n_pit) * alpha_obj
    # rune track
    r0, r1 = 144.8, 159.3
    gl = []
    ids = [4, 6, 9, 1, 0, 2, 7, 5] if mir else [0, 2, 5, 8, 3, 7, 1, 9]
    k = 0
    for a0 in (0, 90, 180, 270):
        for off in (-21, 21):
            gl.append(((a0 + off) % 360, ids[k], 7.1)); k += 1
    U = build_unrolled(gl, TN, r0, r1, ppu)
    rune = sample_unrolled(U, r, th, r0, ppu, TN) * band * (1 - clasp)
    Hm -= 1.6 * rune
    # ritual ticks along the outer rim
    tick_step = 360. / 60
    ta = ((th * 180 / np.pi) % tick_step) / tick_step
    tw = 0.4 / (r * (np.pi / 180) * tick_step)
    ticks = (1 - sstep(tw, tw * 1.6, np.minimum(ta, 1 - ta))) * sstep(R_RIM0 + .5, R_RIM0 + 1.0, r) * (1 - sstep(R_RIM1 - 1.0, R_RIM1 - .5, r)) * outer * 0
    Hm -= 0.8 * ticks
    # cracks
    def cracks(specs):
        im = Image.new('L', (Ww, Hh), 0); d = ImageDraw.Draw(im)
        for (x, y, ang, ln, w) in specs:
            Pp = [(x, y)]; a = ang
            for i in range(int(ln / 3)):
                a += rng.normal(0, .35); x += 3 * math.cos(a); y += 3 * math.sin(a); Pp.append((x, y))
            d.line([(px * SS, py * SS) for px, py in Pp], fill=255, width=max(1, int(w * SS)), joint='curve')
        return blur(np.asarray(im).astype(F) / 255., .5 * SS)
    cs = []
    for a_deg, rr, ln in [(22, 158, 24), (302, 141, 24), (158, 143, 22), (250, 158, 22), (112, 158, 20), (347, 145, 20), (60, 158, 18), (205, 146, 22)]:
        x, y = polar_pt(a_deg + rng.normal(0, 3), rr)
        aa = math.atan2(CY - y, CX - x) + math.radians(rng.normal(0, 35))
        cs.append((x, y, aa, ln, .65))
    crack = np.clip(cracks(cs) * 1.6, 0, 1) * (band + outer * .7)
    Hm -= 1.5 * crack
    # nails
    nails = np.zeros(shape, F); nail_glow = np.zeros(shape, F); nail_rim = np.zeros(shape, F)
    def dome(cx_, cy_, rad):
        d = np.hypot(X - cx_, Y - cy_); return np.clip(1 - (d / rad) ** 2, 0, 1)
    nail_pts = []
    for a0 in clasp_ang:
        for rr in (145.0, 161.0): nail_pts.append(polar_pt(a0, rr))
    for a0 in (90, 180, 270):
        for off in (-3.4, 3.4): nail_pts.append(polar_pt(a0 + off, 152.0))
    glow_idx = (1, 4, 9, 11) if not mir else (2, 7, 8, 10)
    for i, (px, py) in enumerate(nail_pts):
        rad = 3.3
        dm = dome(px, py, rad); nails = np.maximum(nails, dm)
        nail_rim = np.maximum(nail_rim, (np.hypot(X - px, Y - py) < rad + .8).astype(F))
        if i in glow_idx: nail_glow = np.maximum(nail_glow, dome(px, py, 2.0) ** .6)
    Hm += 3.0 * np.sqrt(nails) * (nails > 0)
    Hm -= 0.9 * blur(nail_rim, .45 * SS) * (1 - (nails > 0))
    # seal: almond eye + outline
    eye_c = (CX, CY + 174)
    ex, ey = (X - eye_c[0]), (Y - eye_c[1])
    EH = 11.5
    wd = 5.4 * np.clip(1 - (ey / EH) ** 2, 0, 1) ** .8
    eye_mask = blur((np.abs(ex) < wd).astype(F), .25 * SS)
    pupil = blur((np.abs(ex) < .95 * np.clip(1 - (ey / 9) ** 2, 0, 1) ** .5).astype(F) * (np.abs(ey) < 9), .25 * SS)
    seal_out = blur(rounded_poly_mask([(0, 155), (11, 170), (8.5, 189), (0, 200), (-8.5, 189), (-11, 170)], CX, CY, SS, shape), .3 * SS)
    outl_ring = np.clip(1 - np.abs(seal_out - .5) * 6, 0, 1) * seal_m
    Hm -= 3.0 * eye_mask + 1.0 * outl_ring
    Hm += 1.3 * pupil
    Hm *= (alpha_obj > .01)

    # ----- normals -----
    Hs = blur(Hm, .5 * SS)
    gy, gx = np.gradient(Hs, 1. / SS)
    nx, ny, nz = -gx, -gy, np.ones(shape, F)
    nl = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2); nx, ny, nz = nx / nl, ny / nl, nz / nl
    curv = Hm - blur(Hm, 1.3 * SS)
    cav = blur(Hm, 4 * SS) - blur(Hm, 1.0 * SS)

    # ----- albedo -----
    lin = lambda c: np.array(c, F) ** 2.2
    iron = lin((.105, .098, .098)); rust = lin((.22, .09, .045)); bronze = lin((.36, .26, .15)); ash = lin((.40, .38, .36)); soot = lin((.025, .023, .024))
    alb = iron[None, None, :] * (.6 + .8 * n_mid + .25 * n_hi + .5 * (streak - .5))[..., None]
    rustm = sstep(.64, .85, fbm(rng, shape, 30 * SS, 3) + .2 * (n_hi - .5) + .2 * np.clip(curv, 0, 2)) * .6
    alb = alb * (1 - rustm[..., None]) + rust[None, None, :] * (.4 + 1.2 * n_hi)[..., None] * rustm[..., None]
    wear = np.clip(curv * 1.5, 0, 1) * sstep(.3, .6, n_mid + .25 * (n_hi - .5)) * alpha_obj
    alb = alb * (1 - .65 * wear[..., None]) + bronze[None, None, :] * (.5 + .8 * n_hi)[..., None] * .6 * wear[..., None]
    rimline = (bump(rw, R_OUT - .8, .9) * band + bump(rw, R_RIM1 - .8, .8) * outer + np.maximum(0, clasp - blur(clasp, 1.0 * SS) * 1.0) * 1.0 + seal_m * np.clip(1 - blur(seal_m, 1.1 * SS), 0, 1))
    rimline = np.clip(rimline, 0, 1) * (.45 + .8 * n_hi) * (.6 + .6 * n_mid)
    steel = lin((.42, .38, .34))
    alb = alb * (1 - .85 * rimline[..., None]) + steel[None, None, :] * .85 * rimline[..., None]
    alb = alb * (1 - .85 * wire[..., None]) + (lin((.27, .18, .09))[None, None, :] * (.55 + .9 * n_hi)[..., None]) * .85 * wire[..., None]
    groove = np.clip(np.maximum.reduce([rune, crack, ticks * .7, seam, eye_mask, outl_ring * .8]), 0, 1)
    alb = alb * (1 - .8 * groove[..., None]) + soot[None, None, :] * .8 * groove[..., None]
    ashm = sstep(.5, .74, fbm(rng, shape, 12 * SS, 3)) * np.clip(-ny * 1.5 + .15, 0, 1) * alpha_obj * (.4 + .8 * np.clip(cav, 0, 1))
    alb = alb * (1 - .5 * ashm[..., None]) + ash[None, None, :] * .5 * ashm[..., None]

    # ----- lighting -----
    L = np.array([-.42, -.66, .62], F); L /= np.linalg.norm(L)
    ndl = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    hv = L + np.array([0, 0, 1], F); hv /= np.linalg.norm(hv)
    ndh = np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1)
    ao = np.clip(1 - .55 * np.clip(cav * .9, 0, 1), .3, 1)
    lightc = np.array([1.0, .90, .78], F); amb = np.array([.50, .46, .45], F)
    col = alb * (amb[None, None, :] * ao[..., None] + 1.4 * (ndl * ao)[..., None] * lightc[None, None, :])
    ks = .05 + .5 * wear + .12 * (1 - rustm) * (streak) + .12 * wire + .3 * rimline
    col += (ks * ndh ** 20 * ao)[..., None] * np.array([1., .85, .7], F)[None, None, :] * .8
    n_in = (nx * (-ix) + ny * (-iy)) / np.maximum(r, 1)
    gi = np.exp(-(r - R_IN) / 6.) * (.25 + .75 * np.clip(n_in * 1.6 + .2, 0, 1))
    col += (glowc[None, None, :] * .30) * (gi * alpha_obj)[..., None] * (.4 + alb.mean(-1)[..., None] * 3.)

    # ----- embers -----
    lit_ids = (1, 3, 4, 6) if not mir else (0, 2, 5, 7)
    Uall = np.zeros_like(rune)
    for gi_, (ang, gid, hh) in enumerate(gl):
        if gi_ in lit_ids:
            Ug = build_unrolled([(ang, gid, hh)], TN, r0, r1, ppu)
            Uall = np.maximum(Uall, sample_unrolled(Ug, r, th, r0, ppu, TN))
    lit = Uall * band * (1 - clasp)
    em = np.zeros(shape + (3,), F)
    def add_em(mask, intens, color, bloom, bint):
        nonlocal em
        em += mask[..., None] * intens * color[None, None, :]
        if bloom > 0: em += blur(mask, bloom * SS)[..., None] * bint * color[None, None, :]
    add_em(lit * (.65 + .35 * n_hi), 1.15, ember, 1.6, .7)
    add_em(lit ** 2, .45, hot, 0, 0)
    add_em(nail_glow * .7, .8, ember, 1.5, .5)
    topg = top * sstep(R_IN + 3, R_IN + 5, r) * (1 - sstep(R_OUT - 5, R_OUT - 1, r)) * (.45 + .7 * n_mid)
    add_em(topg, .75, ember, 2.0, .6)
    hot_crack = crack * sstep(.58, .78, fbm(rng, shape, 22 * SS, 2))
    add_em(hot_crack, .7, ember, 1.5, .4)
    eye_glow = eye_mask * (1 - pupil) * (.55 + .45 * (1 - np.abs(ey) / EH).clip(0, 1))
    add_em(eye_glow, .8, ember, 1.8, .5)
    add_em(eye_glow ** 3 * (1 - np.abs(ey) / EH).clip(0, 1), .35, hot, 0, 0)
    nseg = 30
    seg = (np.sin(th * nseg + 1.3) > -.3).astype(F)
    hl = bump(r, 143.3, .5) * band * (.5 + .5 * seg) * (.5 + .5 * n_hi) * (1 - clasp)
    add_em(hl * .75, .8, glowc, 1.6, .5)
    col += em * alpha_obj[..., None]

    col = np.clip(col, 0, 1.6)
    col = col / (1 + .18 * np.clip(col - 1, 0, None))
    col = np.clip(col, 0, 1) ** (1 / 2.2)

    # ----- shadow / halo -----
    sh_src = np.zeros_like(alpha_obj); sh_src[int(2.5 * SS):] = alpha_obj[:-int(2.5 * SS)]
    halo = np.clip(blur(sh_src, 4 * SS) * 1.5, 0, .55) * (1 - alpha_obj) * sstep(R_IN + 1, R_IN + 4, r) * (1 - sstep(482, 498, Y))
    A = alpha_obj + halo * (1 - alpha_obj)
    inner = np.exp(-(R_IN - r) / 4.5) * (r < R_IN) * .55 * sstep(R_IN - 14, R_IN - 6, r)
    A = np.clip(A + inner * (1 - A), 0, 1)
    colp = col * alpha_obj[..., None] + 0.02 * (A - alpha_obj)[..., None]
    def down(a):
        return a.reshape(H0, SS, W0, SS, *a.shape[2:]).mean(axis=(1, 3))
    Ad = down(A); Cd = down(colp)
    rgb = np.where(Ad[..., None] > 1e-4, Cd / np.maximum(Ad[..., None], 1e-4), 0)
    out = np.dstack([np.clip(rgb, 0, 1), Ad])
    print(kind, 'rendered', round(time.time() - t0, 1), 's')
    return (out * 255 + .5).astype(np.uint8)

if __name__ == '__main__':
    # python3 tools/gen_orb_frames.py [supersample=4] [outdir=assets/ui]  -> orb-l.webp (health), orb-r.webp (stamina)
    import os
    outdir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'ui')
    for kind, seed, name in (('health', 11, 'orb-l.webp'), ('stamina', 29, 'orb-r.webp')):
        a = render(kind, seed)
        Image.fromarray(a, 'RGBA').save(os.path.join(outdir, name), 'WEBP', quality=88, method=6, exact=False)
