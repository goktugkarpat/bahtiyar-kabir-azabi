#!/usr/bin/env python3
"""Builds assets/equipment/boss-thumbnails.js (ajan: bossloot).

Boss-only items get their own inventory icon in the SAME style / size / format as assets/equipment/thumbnails.js
(256x256 transparent WebP renders of the worn model): the existing render of the item's fitted core is re-graded in the
boss's colour, wrapped in a thin gold rim + soft glow, and stamped with the boss crest in the lower-right corner.
The eight existing signature items (executioner-axe, ...) get the rim + crest only (their render is kept).
Run from the game folder:  python3 tools/boss_icons.py
"""
import base64, io, math, re, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/equipment/thumbnails.js')
OUT = os.path.join(ROOT, 'assets/equipment/boss-thumbnails.js')
GOLD = (214, 180, 117)

# boss key -> (accent colour, crest)
BOSS = {
    '1': ((196, 70, 58), 'chain'), '2': ((70, 178, 176), 'bell'), '3': ((214, 200, 150), 'crown'),
    'ruinwarden': ((190, 160, 90), 'visor'), '4': ((240, 124, 46), 'flame'), 'ashwarden': ((206, 160, 120), 'visor'),
    '5': ((224, 210, 190), 'scales'), 'verdictwarden': ((196, 90, 110), 'visor'),
}
# item id -> (boss key, base render id or None = keep the existing render, hue shift deg, saturation, value)
ITEMS = {
    # chapter I
    'executioner-axe': ('1', None, 0, 1, 1), 'rusted-mail-chest': ('1', 'warden-chainmail', -8, 1.1, .95),
    'headsman-hood': ('1', 'buried-prayer-hood', -10, 1.25, .8), 'hook-chain-gauntlets': ('1', 'chain-gloves', -6, 1.3, .9),
    # chapter II
    'bell-spear': ('2', None, 0, 1, 1), 'drowned-clapper-axe': ('2', 'mourning-axe', 120, 1.1, 1.0),
    'bellringer-bronze-chest': ('2', 'coast-chest', 28, 1.3, 1.0), 'drowned-ringer-helm': ('2', 'drowned-helm', 18, 1.3, 1.0),
    'tide-chain-boots': ('2', 'tide-boots', 14, 1.2, 1.0),
    # chapter III
    'hollow-crown-blade': ('3', None, 0, 1, 1), 'hollow-scepter-spear': ('3', 'bell-spear', 46, .7, 1.12),
    'king-ossuary-chest': ('3', 'hollow-heart-chest', 6, .75, 1.2), 'hollow-king-spurs': ('3', 'throneless-steps', 4, .8, 1.15),
    'warden-chainmail': ('ruinwarden', None, 0, 1, 1), 'warden-verdict-helm': ('ruinwarden', None, 0, 1, 1),
    'warden-iron-claws': ('ruinwarden', 'black-stone-gauntlets', 10, .85, 1.1),
    # chapter IV
    'furnace-oath-axe': ('4', None, 0, 1, 1), 'heart-forged-sword': ('4', 'slag-edge-sword', -150, 1.7, 1.0),
    'anvil-heart-chest': ('4', 'ash-warden-chest', -10, 1.4, .95), 'furnace-heart-helm': ('4', 'sealed-furnace-helm', -18, 1.6, 1.0),
    'cinder-breath-boots': ('4', 'dead-forge-steps', -8, 1.3, 1.0),
    'ash-warden-chest': ('ashwarden', None, 0, 1, 1), 'ash-warden-grasp': ('ashwarden', None, 0, 1, 1),
    'ash-warden-greaves': ('ashwarden', 'ash-road-boots', 6, .9, 1.05),
    # chapter V
    'last-verdict-blade': ('5', None, 0, 1, 1), 'black-gavel-axe': ('5', 'void-oath-axe', -150, 1.5, .95),
    'qadi-black-robe': ('5', 'mourner-chest', -14, 1.2, .8), 'qadi-iron-turban': ('5', 'verdict-warden-helm', 0, .6, 1.05),
    'verdict-warden-helm': ('verdictwarden', None, 0, 1, 1), 'verdict-warden-chest': ('verdictwarden', None, 0, 1, 1),
    'verdict-warden-boots': ('verdictwarden', 'last-road-boots', -14, 1.3, .95),
}


def load_thumbs():
    s = open(SRC).read()
    return {k: base64.b64decode(v) for k, v in re.findall(r'"([a-z\-]+)":"data:image/webp;base64,([^"]+)"', s)}


def grade(img, hue, sat, val, accent):
    rgba = np.array(img.convert('RGBA'), dtype=np.float32) / 255.
    a = rgba[..., 3:]
    hsv = np.array(Image.fromarray((rgba[..., :3] * 255).astype(np.uint8)).convert('HSV'), dtype=np.float32)
    hsv[..., 0] = (hsv[..., 0] + hue / 360. * 255.) % 255.
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * val, 0, 255)
    rgb = np.array(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB'), dtype=np.float32) / 255.
    lum = (rgb * np.array([.3, .59, .11])).sum(-1, keepdims=True)
    tint = lum * (np.array(accent, dtype=np.float32) / 255.) * 1.6
    rgb = np.clip(rgb * .72 + tint * .28, 0, 1)
    out = np.concatenate([rgb, a], -1)
    return Image.fromarray((out * 255).astype(np.uint8), 'RGBA')


def rim_and_glow(img, accent):
    alpha = img.split()[3]
    grown = alpha.filter(ImageFilter.MaxFilter(5))
    rim = Image.new('L', img.size, 0)
    rim.paste(grown, (0, 0)); rim = Image.fromarray(np.clip(np.array(rim, dtype=np.int16) - np.array(alpha, dtype=np.int16), 0, 255).astype(np.uint8))
    rim = rim.filter(ImageFilter.GaussianBlur(.6))
    glow = alpha.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(7))
    glow = glow.point(lambda v: int(v * .55))
    base = Image.new('RGBA', img.size, (0, 0, 0, 0))
    g = Image.new('RGBA', img.size, accent + (0,)); g.putalpha(glow)
    base = Image.alpha_composite(base, g)
    r = Image.new('RGBA', img.size, GOLD + (0,)); r.putalpha(rim.point(lambda v: min(255, int(v * 1.5))))
    base = Image.alpha_composite(base, r)
    return Image.alpha_composite(base, img)


def crest(kind, size):
    """Draws the boss crest in light gold on transparent, supersampled."""
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    c = GOLD + (255,); w = max(2, S // 14)
    P = lambda *pts: [(x / 24 * S, y / 24 * S) for x, y in pts]
    if kind == 'chain':
        for cx, cy, ang in ((8.5, 9, -35), (15.5, 15, -35)):
            pts = [(cx + 5.5 * math.cos(t) * math.cos(math.radians(ang)) - 3.4 * math.sin(t) * math.sin(math.radians(ang)),
                    cy + 5.5 * math.cos(t) * math.sin(math.radians(ang)) + 3.4 * math.sin(t) * math.cos(math.radians(ang))) for t in [i / 24 * 2 * math.pi for i in range(25)]]
            d.line(P(*pts), fill=c, width=w, joint='curve')
    elif kind == 'bell':
        d.polygon(P((12, 3), (8.5, 5), (7, 10), (7, 14), (4.5, 18), (19.5, 18), (17, 14), (17, 10), (15.5, 5)), fill=c)
        d.ellipse(P((10, 18.5), (14, 22.5)), fill=c)
    elif kind == 'crown':
        d.polygon(P((3, 19), (4, 8), (9, 12.5), (12, 5), (15, 12.5), (20, 8), (21, 19)), fill=c)
    elif kind == 'flame':
        d.polygon(P((12, 2), (14.5, 6.5), (18.5, 10), (19, 15), (16, 20.5), (12, 22), (8, 20.5), (5, 15), (6.5, 10.5), (9, 11), (10.5, 7.5)), fill=c)
    elif kind == 'scales':
        d.line(P((12, 3), (12, 20)), fill=c, width=w); d.line(P((6, 21), (18, 21)), fill=c, width=w); d.line(P((4, 7), (20, 7)), fill=c, width=w)
        d.polygon(P((4, 7.5), (1.5, 14), (6.5, 14.5)), fill=c); d.polygon(P((20, 7.5), (22.5, 14), (17.5, 14.5)), fill=c)
    else:  # visor
        d.polygon(P((5, 21), (5, 10), (8, 5), (12, 3.5), (16, 5), (19, 10), (19, 21), (15, 18), (12, 21), (9, 18)), fill=c)
        d.rectangle(P((7.5, 10.5), (10.5, 12.5)), fill=(0, 0, 0, 0)); d.rectangle(P((13.5, 10.5), (16.5, 12.5)), fill=(0, 0, 0, 0))
    return im.resize((size, size), Image.LANCZOS)


def badge(img, accent, kind):
    B = 62
    over = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(over)
    x0, y0 = img.size[0] - B - 6, img.size[1] - B - 6
    d.ellipse((x0, y0, x0 + B, y0 + B), fill=(14, 11, 9, 235), outline=GOLD + (255,), width=3)
    d.ellipse((x0 + 5, y0 + 5, x0 + B - 5, y0 + B - 5), outline=accent + (200,), width=2)
    cr = crest(kind, B - 24)
    over.alpha_composite(cr, (x0 + 12, y0 + 12))
    return Image.alpha_composite(img, over)


def main():
    thumbs = load_thumbs()
    out = {}
    for item, (boss, base, hue, sat, val) in ITEMS.items():
        accent, kind = BOSS[boss]
        src = thumbs[base or item]
        img = Image.open(io.BytesIO(src)).convert('RGBA')
        if base:
            img = grade(img, hue, sat, val, accent)
        img = rim_and_glow(img, accent)
        img = badge(img, accent, kind)
        buf = io.BytesIO(); img.save(buf, 'WEBP', quality=88, method=6)
        out[item] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    body = ','.join('"%s":"%s"' % (k, v) for k, v in out.items())
    js = ('/* ajan:bossloot — icons of the boss-only items (tools/boss_icons.py): the fitted core\'s render re-graded in the boss colour, gold rim + boss crest. */\n'
          '(function(){const B=window.BABA=window.BABA||{};const own={' + body + '};\n'
          'B.EquipmentThumbnails=Object.freeze(Object.assign({},B.EquipmentThumbnails||{},own));\n'
          '// World symbols (ground-loot.js) use transparent renders: the same pictures work there.\n'
          'B.GroundEquipmentThumbnails=Object.freeze(Object.assign({},B.GroundEquipmentThumbnails||{},own));})();\n')
    open(OUT, 'w').write(js)
    print('wrote', OUT, len(out), 'icons', len(js) // 1024, 'KB')
    sheet = Image.new('RGB', (256 * 8, 256 * 4), (38, 34, 32))
    for i, (k, v) in enumerate(out.items()):
        im = Image.open(io.BytesIO(base64.b64decode(v.split(',')[1]))).convert('RGBA')
        sheet.paste(im, ((i % 8) * 256, (i // 8) * 256), im)
    if len(sys.argv) > 1: sheet.save(sys.argv[1])


if __name__ == '__main__':
    main()
