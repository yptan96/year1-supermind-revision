# -*- coding: utf-8 -*-
"""Makes training pictures for the on-device handwriting reader.
Each letter is drawn from many fonts, thinned to a pen centre-line, then bent, slanted, resized and thickened at random
so it looks like finger writing. Output: data/train.npz and data/val.npz (28x28 pictures + class numbers).
Validation uses fonts the model never sees in training (a fair test of "new handwriting styles").
Run:  python tools/handwriting/make_data.py
"""
import os, sys, math, random, glob
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'data'); os.makedirs(OUT, exist_ok=True)
FONT_DIR = os.environ.get('HW_FONTS', 'C:/Users/SENGHA~1/AppData/Local/Temp/fonts')
WIN = 'C:/Windows/Fonts/'

TRAIN_FONTS = ['Andika-Regular.ttf', 'PatrickHand-Regular.ttf', 'ComicNeue-Regular.ttf', 'ShortStack-Regular.ttf', 'Itim-Regular.ttf',
               'GochiHand-Regular.ttf', 'Kalam-Regular.ttf', 'Neucha.ttf', 'Sniglet-Regular.ttf', 'Fredoka[wdth,wght].ttf', 'Baloo2[wght].ttf']
TRAIN_WIN = ['Inkfree.ttf', 'segoepr.ttf', 'comic.ttf', 'arial.ttf', 'calibri.ttf', 'trebuc.ttf', 'tahoma.ttf', 'BRADHITC.TTF']
VAL_FONTS = ['Mali-Regular.ttf', 'Delius-Regular.ttf']
VAL_WIN = ['verdana.ttf', 'comicbd.ttf']

# classes. Pairs that differ only by size are ONE class here (c/C, o/O, ...); the page decides big or small from the height.
LETTERS = sorted(set(list('abdefghijkmnpqrtuy') + list('ABDEFGHJKLMNPQRTUY')))
MERGED = ['c', 'o', 's', 'v', 'w', 'x', 'z', 'I']   # c/C o/O s/S v/V w/W x/X z/Z and I/l
CLASSES = LETTERS + MERGED + ['?', '!']
# letters that are drawn as upper+lower in the same class
ALIAS = {'C': 'c', 'O': 'o', 'S': 's', 'V': 'v', 'W': 'w', 'X': 'x', 'Z': 'z', 'l': 'I'}
CHARS = list(dict.fromkeys(list('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') + ['?', '!']))
IDX = {c: i for i, c in enumerate(CLASSES)}
def cls_of(ch): return IDX[ALIAS.get(ch, ch)]

def fpath(name, win):
    return (WIN + name) if win else os.path.join(FONT_DIR, name)

def glyph_skeleton(font, ch, size=220):
    img = Image.new('L', (320, 320), 0)
    d = ImageDraw.Draw(img)
    try:
        bb = d.textbbox((0, 0), ch, font=font)
    except Exception:
        return None
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    if w < 4 or h < 4: return None
    d.text(((320 - w) / 2 - bb[0], (320 - h) / 2 - bb[1]), ch, font=font, fill=255)
    a = np.array(img) > 128
    sk = skeletonize(a)
    return sk.astype(np.uint8) * 255

def load_skeletons(fonts):
    out = {}
    for name, win in fonts:
        p = fpath(name, win)
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            print('skip font', name); continue
        try:
            font = ImageFont.truetype(p, 220)
        except Exception as e:
            print('bad font', name, e); continue
        for ch in CHARS:
            sk = glyph_skeleton(font, ch)
            if sk is not None: out[(name, ch)] = sk
    return out

rng = random.Random(1)
def elastic(img, alpha, sigma):
    h, w = img.shape
    dx = cv2.GaussianBlur((np.random.rand(h, w).astype(np.float32) * 2 - 1), (0, 0), sigma) * alpha
    dy = cv2.GaussianBlur((np.random.rand(h, w).astype(np.float32) * 2 - 1), (0, 0), sigma) * alpha
    xs, ys = np.meshgrid(np.arange(w), np.arange(h))
    return cv2.remap(img, (xs + dx).astype(np.float32), (ys + dy).astype(np.float32), cv2.INTER_LINEAR, borderValue=0)

def make_one(sk):
    img = sk.astype(np.float32)
    h, w = img.shape
    ang = np.clip(np.random.randn() * 7, -18, 18) * math.pi / 180
    shear = np.random.uniform(-0.28, 0.28)
    sx, sy = np.random.uniform(0.7, 1.25), np.random.uniform(0.8, 1.2)
    M = np.array([[sx * math.cos(ang), -sy * math.sin(ang) + shear, 0], [sx * math.sin(ang), sy * math.cos(ang), 0]], np.float32)
    c = np.array([w / 2, h / 2]); M[:, 2] = c - M[:, :2] @ c
    img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR)
    if rng.random() < 0.8:
        img = elastic(img, np.random.uniform(3, 12), np.random.uniform(7, 12))
    img = (img > 0.12).astype(np.uint8) * 255
    ys, xs = np.nonzero(img)
    if len(xs) < 5: return None
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    gh = max(y1 - y0, x1 - x0, 1)
    r = max(1, int(round(gh * np.random.uniform(0.035, 0.085))))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    img = cv2.dilate(img, k)
    ys, xs = np.nonzero(img)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    crop = img[y0:y1 + 1, x0:x1 + 1]
    ch, cw = crop.shape
    s = 20.0 / max(ch, cw)
    nh, nw = max(1, int(round(ch * s))), max(1, int(round(cw * s)))
    small = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    canvas = np.zeros((28, 28), np.float32)
    # centre by centre of mass
    yy, xx = np.nonzero(small > 0.01)
    mass = small.sum()
    cy = (small.sum(1) * np.arange(nh)).sum() / mass; cx = (small.sum(0) * np.arange(nw)).sum() / mass
    oy, ox = int(round(14 - cy)), int(round(14 - cx))
    oy = max(0, min(28 - nh, oy)); ox = max(0, min(28 - nw, ox))
    canvas[oy:oy + nh, ox:ox + nw] = small
    return canvas

def build(skels, per, seed):
    np.random.seed(seed); rng.seed(seed)
    X, Y = [], []
    items = list(skels.items())
    for (name, ch), sk in items:
        n = per
        for _ in range(n):
            im = make_one(sk)
            if im is not None:
                X.append(im); Y.append(cls_of(ch))
    X = np.array(X, np.float16); Y = np.array(Y, np.int16)
    p = np.random.permutation(len(X))
    return X[p], Y[p]

if __name__ == '__main__':
    tr = load_skeletons([(n, False) for n in TRAIN_FONTS] + [(n, True) for n in TRAIN_WIN])
    va = load_skeletons([(n, False) for n in VAL_FONTS] + [(n, True) for n in VAL_WIN])
    print('train glyphs', len(tr), 'val glyphs', len(va), 'classes', len(CLASSES))
    per = int(sys.argv[1]) if len(sys.argv) > 1 else 90
    Xt, Yt = build(tr, per, 1)
    Xv, Yv = build(va, max(20, per // 3), 2)
    np.savez_compressed(os.path.join(OUT, 'train.npz'), x=Xt, y=Yt)
    np.savez_compressed(os.path.join(OUT, 'val.npz'), x=Xv, y=Yv)
    with open(os.path.join(OUT, 'classes.txt'), 'w', encoding='utf8') as f: f.write('\n'.join(CLASSES))
    print('train', Xt.shape, 'val', Xv.shape)
    # sample sheet to look at
    sheet = np.zeros((28 * 6, 28 * 24), np.float32)
    for k in range(6 * 24):
        r, c = divmod(k, 24); sheet[r * 28:(r + 1) * 28, c * 28:(c + 1) * 28] = Xt[k].astype(np.float32)
    cv2.imwrite(os.path.join(OUT, 'sample.png'), (sheet * 255).astype(np.uint8))
