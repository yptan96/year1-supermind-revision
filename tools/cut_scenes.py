# -*- coding: utf-8 -*-
"""Cuts the 20 scene pictures out of the Canva slides (removes the slide background, panel, grass and flowers)
and saves them as img/scene-01.png ... scene-20.png (transparent, 640px wide). Also img/notebook.png from the notebook picture.
Run: python tools/cut_scenes.py [slide numbers...]   (no numbers = all)"""
import os, sys
import numpy as np
import cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), 'Year 1 Flashcard')
OUT = os.path.join(ROOT, 'img')

OPTS = {1: dict(close=75), 11: dict(decor=True, cut_y=0.855)}

def cut(path, debug_name=None, close=15, decor=False, cut_y=None):
    bgr = cv2.imread(path)
    h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    S = hsv[:, :, 1] / 255; V = hsv[:, :, 2] / 255; H = hsv[:, :, 0] * 2
    # what is certainly picture: the dark outline, and strong colours.  The slide background is pale and soft.
    outline = (V < 0.42)
    vivid = (S > 0.50) & (V > 0.35)
    seed = (outline | vivid).astype(np.uint8)
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close)))
    # keep only the big connected pieces (drops flower dots and grass specks)
    n, lab, st, _ = cv2.connectedComponentsWithStats(seed, connectivity=8)
    keep = np.zeros_like(seed)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 0.004 * w * h: keep[lab == i] = 1
    # fill the inside of every closed outline (white eyes, pale fur, white pages)
    inv = (1 - keep).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    filled = keep.copy()
    for i in range(1, n2):
        x, y, ww, hh, a = st2[i]
        touches = x == 0 or y == 0 or x + ww == w or y + hh == h
        if not touches: filled[lab2 == i] = 1
    # grabCut to clean the edge
    gc = np.full((h, w), cv2.GC_BGD, np.uint8)
    dil = cv2.dilate(filled, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
    gc[dil > 0] = cv2.GC_PR_BGD
    gc[filled > 0] = cv2.GC_PR_FGD
    core = cv2.erode(filled, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    gc[core > 0] = cv2.GC_FGD
    try:
        bg = np.zeros((1, 65), np.float64); fg = np.zeros((1, 65), np.float64)
        cv2.grabCut(bgr, gc, None, bg, fg, 3, cv2.GC_INIT_WITH_MASK)
        mask = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
    except Exception as e:
        print('grabcut failed', e); mask = filled
    # keep the biggest pieces only again, smooth the edge
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n3, lab3, st3, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    m2 = np.zeros_like(mask)
    big = max(st3[1:, cv2.CC_STAT_AREA]) if n3 > 1 else 0
    for i in range(1, n3):
        if st3[i, cv2.CC_STAT_AREA] > 0.06 * big: m2[lab3 == i] = 1
    if decor:   # grass and flowers from the slide template that overlap the bottom of the picture
        yy = np.arange(h)[:, None] > 0.80 * h
        grass = (H > 55) & (H < 160) & (S > 0.12) & (V > 0.45)
        petals = (((H > 300) & (H <= 360) & (S > 0.25) & (S < 0.52) & (V > 0.80)) | ((S < 0.08) & (V > 0.93)))
        kill = (yy & (grass | petals)).astype(np.uint8)
        kill = cv2.dilate(kill, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        m2[(kill > 0) & (m2 > 0)] = 0
        m2 = cv2.morphologyEx(m2, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        n4, lab4, st4, _ = cv2.connectedComponentsWithStats(m2, connectivity=8)
        big4 = max(st4[1:, cv2.CC_STAT_AREA]) if n4 > 1 else 0
        for i in range(1, n4):
            if st4[i, cv2.CC_STAT_AREA] < 0.06 * big4: m2[lab4 == i] = 0
    if cut_y: m2[int(cut_y * h):, :] = 0   # the template's grass covers the bottom of this picture: stop above it
    alpha = cv2.GaussianBlur(m2.astype(np.float32), (0, 0), 1.2)
    rgba = np.dstack([cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), (alpha * 255).astype(np.uint8)])
    img = Image.fromarray(rgba, 'RGBA')
    bb = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    img = img.crop(bb)
    return img

def save(img, name, width=640):
    s = width / img.width
    if s < 1: img = img.resize((width, max(1, int(img.height * s))), Image.LANCZOS)
    q = img.quantize(colors=220, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(os.path.join(OUT, name), optimize=True)

if __name__ == '__main__':
    only = [int(a) for a in sys.argv[1:]]
    for n in range(1, 21):
        if only and n not in only: continue
        im = cut(os.path.join(SRC, 'Preposition', f'{n}.png'), **OPTS.get(n, {}))
        save(im, f'scene-{n:02d}.png')
        print('scene', n, im.size)
