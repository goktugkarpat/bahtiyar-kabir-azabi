# Builds assets/ui/talents/k-chainfire.png from the project's own k-chains.png + k-pyre.png (recolour + composite; no outside art).
import sys, math
from PIL import Image, ImageFilter
T = sys.argv[1] + '/assets/ui/talents/'
ch = Image.open(T + 'k-chains.png').convert('RGBA'); py = Image.open(T + 'k-pyre.png').convert('RGBA')
W, H = ch.size; C = ch.load(); P = py.load()
cl = lambda v: max(0.0, min(1.0, v))
lumf = lambda p: (.3 * p[0] + .59 * p[1] + .11 * p[2]) / 255
satf = lambda p: (max(p[:3]) - min(p[:3])) / 255
glyph = Image.new('L', (W, H)); flame = Image.new('L', (W, H)); G = glyph.load(); F = flame.load()
for y in range(H):
    for x in range(W):
        r = math.hypot(x - W / 2 + .5, y - H / 2 + .5)
        G[x, y] = int(255 * cl((lumf(C[x, y]) - .5) / .15) * cl((.55 - satf(C[x, y])) / .12) * (r < 44))
        F[x, y] = int(255 * cl((lumf(P[x, y]) - .45) / .2) * (r < 46))
flame = flame.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2)); F = flame.load()
glow = glyph.filter(ImageFilter.GaussianBlur(5)); GL = glow.load()
out = py.copy(); O = out.load()
for y in range(H):
    for x in range(W):
        p = list(P[x, y]); fm = F[x, y] / 255
        dark = (52, 18, 8)
        c = [p[i] * (1 - fm) + dark[i] * fm for i in range(3)]
        ga = cl(GL[x, y] / 255 * 1.6) * .65
        c = [c[i] * (1 - ga) + (255, 97, 20)[i] * ga for i in range(3)]
        gm = G[x, y] / 255
        if gm:
            s = sum(C[x, y][:3]) / 765
            hot = (255, 255 * (.5 + .45 * s), 255 * (.12 + .6 * s * s))
            c = [c[i] * (1 - gm) + hot[i] * gm for i in range(3)]
        O[x, y] = (int(c[0]), int(c[1]), int(c[2]), p[3])
out.save(T + 'k-chainfire.png', optimize=True)
