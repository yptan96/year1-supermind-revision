# -*- coding: utf-8 -*-
"""Makes pretend 'finger writing' (pen strokes) from fonts the reader never saw, for testing the whole reading chain in the page.
Run: python tools/handwriting/make_test_strokes.py   ->  tools/handwriting/test_strokes.json"""
import os, json, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize
from skimage.measure import label

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = 'C:/Users/SENGHA~1/AppData/Local/Temp/fonts/'
FONTS = [FONT_DIR + 'Mali-Regular.ttf', FONT_DIR + 'Delius-Regular.ttf', 'C:/Windows/Fonts/verdana.ttf', 'C:/Windows/Fonts/comicbd.ttf']
WORDS = ['The', 'cat', 'is', 'on', 'the', 'desk.', 'I', 'have', 'got', 'a', 'cheese', 'sandwich.', 'spider', 'in', 'pencil', 'case.',
         'ball', 'under', 'bag.', 'frog', 'book', 'ruler', 'notebook.', 'lizard', 'car.', 'doll', 'go-kart.', 'rat', 'plane', 'duck', 'bike.',
         'Is', 'it', 'a', 'pen?', 'banana', 'apple', 'Ben', 'six', 'quick', 'jump', 'yellow', 'Pizza', 'sausage', 'elephant', 'tiger', 'Yes,', 'Zoo']
WORDS = [w.replace(',', '') for w in WORDS]
PAD_H = 240; PAD_W = 345

def order(points):
    pts = [tuple(p) for p in points]
    if not pts: return []
    S = set(pts)
    def nb(p): return [(p[0] + dx, p[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (p[0] + dx, p[1] + dy) in S]
    ends = [p for p in pts if len(nb(p)) <= 1]
    cur = ends[0] if ends else pts[0]
    seen = {cur}; out = [[cur]]
    while True:
        cand = [q for q in nb(cur) if q not in seen]
        if not cand:
            rest = [q for q in S if q not in seen]
            if not rest: break
            # jump to nearest unseen point (a branch of the letter)
            cur = min(rest, key=lambda q: (q[0] - cur[0]) ** 2 + (q[1] - cur[1]) ** 2)
            seen.add(cur); out.append([cur])          # jump: start a new pen stroke
            continue
        cur = min(cand, key=lambda q: abs(q[0] - cur[0]) + abs(q[1] - cur[1]))
        seen.add(cur); out[-1].append(cur)
    return out

def strokes_for(word, fontpath, cap=110, spacing=0.18, wobble=True):
    size = int(cap / 0.72)
    font = ImageFont.truetype(fontpath, size)
    W = int(len(word) * size * 0.95 + 200); H = 400
    img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img)
    x = 40; base = 260
    for ch in word:
        d.text((x, base), ch, font=font, fill=255, anchor='ls')
        adv = font.getlength(ch)
        x += adv + spacing * size * 0.5
    a = np.array(img) > 128
    sk = skeletonize(a)
    lab = label(sk, connectivity=2)
    out = []
    for k in range(1, lab.max() + 1):
        ys, xs = np.nonzero(lab == k)
        if len(xs) < 1: continue
        for pts in order(list(zip(xs.tolist(), ys.tolist()))):
            if len(pts) >= 1: out.append(pts if len(pts) > 1 else pts + pts)
    # place on the pad: baseline at 75% of the pad height, start at the left
    allx = [p[0] for s in out for p in s]
    minx = min(allx)
    res = []
    for s in out:
        res.append([[p[0] - minx + 12 + (random.uniform(-1, 1) if wobble else 0), p[1] - base + 0.66 * PAD_H + (random.uniform(-1, 1) if wobble else 0)] for p in (s[::2] if len(s) > 6 else s)])
    return res

random.seed(3)
tests = []
for w in WORDS:
    for fp in FONTS:
        tests.append({'word': w, 'font': os.path.basename(fp), 'strokes': strokes_for(w, fp)})
json.dump({'padW': PAD_W, 'padH': PAD_H, 'tests': tests}, open(os.path.join(ROOT, 'test_strokes.json'), 'w'), separators=(',', ':'))
print(len(tests), 'tests')
