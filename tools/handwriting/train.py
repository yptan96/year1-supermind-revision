# -*- coding: utf-8 -*-
"""Trains a small convolution network on data/train.npz, reports accuracy on fonts it has NOT seen (data/val.npz),
and writes the weights to ../../models/letters.json for the page to use. Run: python tools/handwriting/train.py [epochs]"""
import os, sys, json, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, 'data')
OUT = os.path.join(ROOT, '..', '..', 'models'); os.makedirs(OUT, exist_ok=True)
torch.manual_seed(0); np.random.seed(0)
classes = open(os.path.join(D, 'classes.txt'), encoding='utf8').read().split('\n')
tr = np.load(os.path.join(D, 'train.npz')); va = np.load(os.path.join(D, 'val.npz'))
Xt = torch.tensor(tr['x'].astype(np.float32)).unsqueeze(1); Yt = torch.tensor(tr['y'].astype(np.int64))
Xv = torch.tensor(va['x'].astype(np.float32)).unsqueeze(1); Yv = torch.tensor(va['y'].astype(np.int64))

class Net(nn.Module):
    def __init__(s, n):
        super().__init__()
        s.c1 = nn.Conv2d(1, 24, 3); s.c2 = nn.Conv2d(24, 24, 3)
        s.c3 = nn.Conv2d(24, 48, 3); s.c4 = nn.Conv2d(48, 48, 3)
        s.f1 = nn.Linear(48 * 4 * 4, 128); s.f2 = nn.Linear(128, n)
        s.drop = nn.Dropout(0.3)
    def forward(s, x):
        x = F.relu(s.c1(x)); x = F.relu(s.c2(x)); x = F.max_pool2d(x, 2)
        x = F.relu(s.c3(x)); x = F.relu(s.c4(x)); x = F.max_pool2d(x, 2)
        x = x.flatten(1); x = s.drop(F.relu(s.f1(x))); return s.f2(x)

net = Net(len(classes))
epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 14
opt = torch.optim.Adam(net.parameters(), 2e-3)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, 4e-3, total_steps=epochs * ((len(Xt) + 255) // 256))

def shift(x):
    # random shift up to 2 px and a little noise, so the page's cropping does not have to be perfect
    dx, dy = np.random.randint(-2, 3), np.random.randint(-2, 3)
    x = torch.roll(x, (dy, dx), (2, 3))
    return x

def evaluate(X, Y):
    net.eval(); ok = 0; top3 = 0
    with torch.no_grad():
        for i in range(0, len(X), 1024):
            o = net(X[i:i + 1024]); ok += (o.argmax(1) == Y[i:i + 1024]).sum().item()
            top3 += (o.topk(3, 1).indices == Y[i:i + 1024].unsqueeze(1)).any(1).sum().item()
    return ok / len(X), top3 / len(X)

t0 = time.time()
for ep in range(epochs):
    net.train(); p = torch.randperm(len(Xt)); tot = 0
    for i in range(0, len(Xt), 256):
        idx = p[i:i + 256]; xb = shift(Xt[idx]); yb = Yt[idx]
        opt.zero_grad(); loss = F.cross_entropy(net(xb), yb, label_smoothing=0.05); loss.backward(); opt.step(); sched.step(); tot += loss.item() * len(idx)
    a, a3 = evaluate(Xv, Yv)
    print(f'epoch {ep+1}/{epochs} loss {tot/len(Xt):.3f}  unseen-font accuracy {a*100:.1f}% (top-3 {a3*100:.1f}%)  {time.time()-t0:.0f}s', flush=True)

# per-class errors on unseen fonts
net.eval()
with torch.no_grad(): pred = net(Xv).argmax(1)
conf = {}
for t, pr in zip(Yv.tolist(), pred.tolist()):
    if t != pr: conf[(classes[t], classes[pr])] = conf.get((classes[t], classes[pr]), 0) + 1
print('most common mix-ups (true -> guessed):', sorted(conf.items(), key=lambda kv: -kv[1])[:15])

def arr(t): return np.round(t.detach().numpy(), 4).tolist()
W = {'classes': classes}
for name, m in [('c1', net.c1), ('c2', net.c2), ('c3', net.c3), ('c4', net.c4), ('f1', net.f1), ('f2', net.f2)]:
    W[name] = {'w': arr(m.weight), 'b': arr(m.bias)}
json.dump(W, open(os.path.join(OUT, 'letters.json'), 'w'), separators=(',', ':'))
torch.save(net.state_dict(), os.path.join(ROOT, 'data', 'net.pt'))
print('saved', os.path.getsize(os.path.join(OUT, 'letters.json')) // 1024, 'KB')
