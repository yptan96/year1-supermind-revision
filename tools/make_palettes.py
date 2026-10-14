# -*- coding: utf-8 -*-
"""Works out which colour words are true for each picture (so 'the orange cat' can be checked against the cat picture).
Writes tools/palettes.json: { picture-name: [colour words] }.  Run: python tools/make_palettes.py
Colours that fill at least 9% of a picture (not counting the dark outline) are counted. Check the result and fix by hand in tools/palette_fixes.json."""
import os, json, glob, colorsys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'img')

def classify(rgb):
    """rgb: (N,3) uint8 -> array of colour words (N,)"""
    x = rgb.astype(np.float32) / 255
    mx = x.max(1); mn = x.min(1); d = mx - mn
    v = mx; sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = x[:, 0], x[:, 1], x[:, 2]
    h = np.zeros(len(x), np.float32)
    dm = np.maximum(d, 1e-6)
    h = np.where(mx == r, ((g - b) / dm) % 6, np.where(mx == g, (b - r) / dm + 2, (r - g) / dm + 4)) * 60
    out = np.full(len(x), 'x', dtype=object)
    outline = (h >= 215) & (h <= 262) & (sat >= 0.25) & (v < 0.42)
    out[outline] = 'outline'
    rest = ~outline
    black = rest & (v < 0.25)
    out[black] = 'black'
    rest &= ~black
    white = rest & (sat < 0.14) & (v > 0.8); out[white] = 'white'; rest &= ~white
    grey = rest & (sat < 0.16); out[grey] = 'grey'; rest &= ~grey
    for name, cond in [
        ('red', ((h < 14) | (h >= 345)) & ((v > 0.55) | (sat > 0.6))),
        ('brown', (h >= 8) & (h < 42) & (v < 0.66) & (sat > 0.3)),
        ('orange', (h >= 14) & (h < 40)),
        ('yellow', (h >= 40) & (h < 68)),
        ('green', (h >= 68) & (h < 165)),
        ('blue', (h >= 165) & (h < 262)),
        ('purple', (h >= 262) & (h < 300)),
        ('pink', (h >= 300) & (h < 345)),
        ('brown', (h < 14) | (h >= 345)),
    ]:
        c = rest & cond; out[c] = name; rest &= ~c
    return out

def dilate(m, n):
    for _ in range(n):
        p = np.pad(m, 1)
        m = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | p[:-2, :-2] | p[2:, 2:] | p[:-2, 2:] | p[2:, :-2]
    return m

pal = {}
for f in sorted(glob.glob(os.path.join(IMG, '*.png'))):
    key = os.path.splitext(os.path.basename(f))[0]
    a = np.asarray(Image.open(f).convert('RGBA'))
    solid = a[:, :, 3] > 200
    if not solid.any(): continue
    names = np.full(a.shape[:2], '', dtype=object)
    names[solid] = classify(a[solid][:, :3])
    near_outline = dilate(names == 'outline', 3)          # blended edge pixels are not real colours
    keep = solid & (names != 'outline') & ~near_outline
    vals = names[keep]
    if len(vals) < 50: vals = names[solid & (names != 'outline')]
    cnt = {}
    for n in vals: cnt[n] = cnt.get(n, 0) + 1
    tot = sum(cnt.values()) or 1
    pal[key] = [k for k, v in sorted(cnt.items(), key=lambda kv: -kv[1]) if v / tot >= 0.10]

fixes_path = os.path.join(ROOT, 'tools', 'palette_fixes.json')
if os.path.exists(fixes_path):
    pal.update(json.load(open(fixes_path, encoding='utf8')))
json.dump(pal, open(os.path.join(ROOT, 'tools', 'palettes.json'), 'w', encoding='utf8'), indent=0, ensure_ascii=False)
for k in ['cat', 'dog', 'ball', 'frog', 'spider', 'duck', 'rat', 'elephant', 'lizard', 'doll', 'plane', 'monster', 'desk', 'bag', 'book', 'car', 'train', 'bike', 'kite', 'ruler', 'pencil', 'rubber', 'go-kart', 'computer-game', 'pencil-case', 'apple', 'banana', 'cake', 'pizza', 'sandwich', 'steak', 'sausage', 'chicken', 'carrots', 'pen']:
    print(k, pal.get(k))
