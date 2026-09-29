# Generates assets/ui/title-death.webp: Cinzel Black text, pitted iron rim, blood-red lit bevel, dark red glow.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
TEXT = sys.argv[1]; OUT = sys.argv[2]
import os
W, H = 1500, int(os.environ.get('TH', 330))
LINES = TEXT.split('\\n'); MAXW, MAXH = int(os.environ.get('MAXW', 1290)), int(os.environ.get('MAXH', 190))
F = '/usr/local/texlive/2021/texmf-dist/fonts/truetype/ndiscovered/cinzel/Cinzel-Black.ttf'
def mask_for(size):
    f = ImageFont.truetype(F, size); m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    b = d.textbbox((0, 0), TEXT, font=f); return f, b
size = 300
def layout(size):
    f = ImageFont.truetype(F, size); lh = int(size*1.02)
    boxes = [ImageDraw.Draw(Image.new('L', (W, H))).textbbox((0, 0), t, font=f) for t in LINES]
    return f, lh, boxes, max(bb[2]-bb[0] for bb in boxes), lh*(len(LINES)-1) + max(bb[3]-bb[1] for bb in boxes)
while True:
    f, lh, boxes, tw, th = layout(size)
    if tw <= MAXW and th <= MAXH: break
    size -= 4
print('size', size, tw, th)
m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
y0 = (H-th)/2 + 4
for i, (t, bb) in enumerate(zip(LINES, boxes)):
    d.text(((W-(bb[2]-bb[0]))/2 - bb[0], y0 + i*lh - bb[1] + (max(x[3]-x[1] for x in boxes)-(bb[3]-bb[1]))*0), t, font=f, fill=255)
ys, xs = np.nonzero(np.asarray(m) > 128); TOP, BOT = ys.min(), ys.max()
face = np.asarray(m, np.float32)/255
rng = np.random.default_rng(7)
def noise(s, sigma):
    n = rng.random((H, W), dtype=np.float32); n = np.asarray(Image.fromarray((n*255).astype('uint8')).filter(ImageFilter.GaussianBlur(sigma)), np.float32)/255
    return (n-n.mean())/(n.std()+1e-6)
def blur(a, r): return np.asarray(Image.fromarray((np.clip(a,0,1)*255).astype('uint8')).filter(ImageFilter.GaussianBlur(r)), np.float32)/255
# rim = dilated mask
rim = np.asarray(m.filter(ImageFilter.MaxFilter(13)), np.float32)/255
rim = blur(rim, 1.2)
# height map for bevel: blurred face + noise pitting
hgt = blur(face, 5)*1.0 + blur(face, 2)*.5 + noise(H*0+1.6, 1.6)*.012*face
gy, gx = np.gradient(hgt*26)
nz = 1.0; L = np.array([-.55, -.75, .6]); L /= np.linalg.norm(L)
norm = np.sqrt(gx**2+gy**2+nz**2)
lam = np.clip((-gx*L[0]-gy*L[1]+nz*L[2])/norm, 0, 1)
spec = np.clip((-gx*L[0]-gy*L[1]+nz*L[2])/norm, 0, 1)**28
yy = np.linspace(0, 1, H)[:, None]*np.ones((1, W))
# vertical gradient: dark blood at top -> hot crimson lower
base = np.stack([.42+.30*yy*0+.18*yy, .02+.02*yy, .03+.02*yy], -1)*0
rows = np.asarray(m).max(1) > 128; bands = []; st = None
for yv in range(H+1):
    on = yv < H and rows[yv]
    if on and st is None: st = yv
    if not on and st is not None: bands.append((st, yv-1)); st = None
# merge tiny bands (i-dots) into the following band, keep one band per text line
merged = []
for b0, b1 in bands:
    if merged and (b0 - merged[-1][1] < 6 or b1 - b0 < 40 and len(merged) < len(LINES)-0 and merged[-1][1] - merged[-1][0] < 40): merged[-1] = (merged[-1][0], b1)
    elif merged and b1 - b0 < 40: merged[-1] = (merged[-1][0], b1)
    else: merged.append((b0, b1))
print('bands', merged)
grad = np.zeros((H, W), np.float32)
for yv in range(H):
    k = min(range(len(merged)), key=lambda i: 0 if merged[i][0] <= yv <= merged[i][1] else min(abs(yv-merged[i][0]), abs(yv-merged[i][1])))
    b0, b1 = merged[k]; grad[yv, :] = np.clip((yv-b0)/(b1-b0+1), 0, 1)
r = 1.0-.20*grad; g = .90-.34*grad; bl = .55-.33*grad
tex = 1+noise(0, 2.6)[..., None]*.07+noise(0, .8)[..., None]*.03
col = np.stack([r, g, bl], -1)*(.78+lam[..., None]*.45)*tex
col += spec[..., None]*np.array([.9, .35, .3])*.4
# inner dark edge for depth
edge = np.clip(face-blur(face, 3.5), 0, 1)
col *= (1-edge[..., None]*.25)
col = np.clip(col, 0, 1)
# iron rim: dark pitted metal with faint highlight on top-left
ih = blur(rim, 3)
igy, igx = np.gradient(ih*10)
ilam = np.clip((-igx*L[0]-igy*L[1]+1)/np.sqrt(igx**2+igy**2+1), 0, 1)
iron = (np.array([.05, .035, .035])*(.4+ilam[..., None]*.9))*(1+noise(0, .9)[..., None]*.16)
# composite
out = np.zeros((H, W, 4), np.float32)
glow = blur(np.asarray(m.filter(ImageFilter.MaxFilter(9)), np.float32)/255, 16)
gl = np.stack([.95*glow, .30*glow, .05*glow], -1)
a_glow = np.clip(glow*.55, 0, 1)
rgb = gl.copy(); a = a_glow.copy()
outer = blur(np.asarray(m.filter(ImageFilter.MaxFilter(17)), np.float32)/255, 1.0)
ring = np.clip(outer-rim, 0, 1)[..., None]
rgb = np.array([.98, .72, .42])*ring*.75+rgb*(1-ring*.75); a = np.maximum(a, ring[..., 0]*.75)
# iron over glow
ra = rim[..., None]
rgb = iron*ra+rgb*(1-ra); a = np.maximum(a, rim)
fa = blur(face, .6)[..., None]
rgb = np.clip(col, 0, 1)*fa+rgb*(1-fa); a = np.maximum(a, fa[..., 0])
# un-premultiply-ish: rgb already blended color; alpha as computed
# make glow color proper: where alpha from glow only, use glow color normalized
alpha = np.clip(a, 0, 1)
prem = rgb
outrgb = np.where(alpha[..., None] > .01, prem/np.maximum(alpha[..., None], .01), 0)
# glow-only zone: rgb was glow premult (color*alpha-ish), so divide fixes it; clamp
outrgb = np.clip(outrgb, 0, 1)
img = np.dstack([outrgb, alpha])
Image.fromarray((img*255).astype('uint8'), 'RGBA').save(OUT, lossless=False, quality=94, method=6) if OUT.endswith('.webp') else Image.fromarray((img*255).astype('uint8'), 'RGBA').save(OUT)
