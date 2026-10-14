/* On-device handwriting reader (nothing leaves the phone).
   Recognizer.load('models/letters.json')  then  Recognizer.read(strokes, padW, padH) -> { text, chars:[{ch, conf, alt:[[ch,p],..], box}] }
   strokes = [ [[x,y],[x,y],...], ... ]  in pad pixels, in the order drawn.
   Steps: 1 group strokes into letters  2 read each letter with a small neural network  3 decide BIG or small letters from their height
          4 find spaces and full stops / ? ! ' - . The pad has guide lines at 25% / 50% / 75% of its height (top, middle, baseline). */
(function (root) {
  'use strict';
  let M = null; // model

  /* ---------- network ---------- */
  const flat = a => Float32Array.from(a.flat(Infinity));
  function prep(l) { return { w: flat(l.w), b: Float32Array.from(l.b), shape: Array.isArray(l.w[0]) && Array.isArray(l.w[0][0]) ? [l.w.length, l.w[0].length, l.w[0][0].length, l.w[0][0][0].length] : [l.w.length, l.w[0].length] }; }
  function conv(inp, ic, ih, iw, L) {
    const [oc, , kh, kw] = L.shape, oh = ih - kh + 1, ow = iw - kw + 1, out = new Float32Array(oc * oh * ow);
    for (let o = 0; o < oc; o++) for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      let s = L.b[o];
      for (let c = 0; c < ic; c++) for (let ky = 0; ky < kh; ky++) for (let kx = 0; kx < kw; kx++)
        s += inp[(c * ih + y + ky) * iw + x + kx] * L.w[((o * ic + c) * kh + ky) * kw + kx];
      out[(o * oh + y) * ow + x] = s > 0 ? s : 0;
    }
    return { d: out, c: oc, h: oh, w: ow };
  }
  function pool(t) {
    const oh = t.h >> 1, ow = t.w >> 1, out = new Float32Array(t.c * oh * ow);
    for (let c = 0; c < t.c; c++) for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const i = (c * t.h + 2 * y) * t.w + 2 * x;
      out[(c * oh + y) * ow + x] = Math.max(t.d[i], t.d[i + 1], t.d[i + t.w], t.d[i + t.w + 1]);
    }
    return { d: out, c: t.c, h: oh, w: ow };
  }
  function fc(inp, L, relu) {
    const [o, n] = L.shape, out = new Float32Array(o);
    for (let i = 0; i < o; i++) { let s = L.b[i]; for (let j = 0; j < n; j++) s += inp[j] * L.w[i * n + j]; out[i] = relu && s < 0 ? 0 : s; }
    return out;
  }
  function classify(img28) { // img28: Float32Array(784) 0..1  -> probabilities
    let t = conv(img28, 1, 28, 28, M.c1); t = conv(t.d, t.c, t.h, t.w, M.c2); t = pool(t);
    t = conv(t.d, t.c, t.h, t.w, M.c3); t = conv(t.d, t.c, t.h, t.w, M.c4); t = pool(t);
    const o = fc(fc(t.d, M.f1, true), M.f2, false);
    let mx = -1e9; for (const v of o) if (v > mx) mx = v;
    let sum = 0; const p = o.map(v => { const e = Math.exp(v - mx); sum += e; return e; });
    return Array.from(p, v => v / sum);
  }

  /* ---------- geometry helpers ---------- */
  const bboxOf = pts => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
  function thin(pts, n) { if (pts.length <= n) return pts; const out = []; for (let i = 0; i < n; i++) out.push(pts[Math.round(i * (pts.length - 1) / (n - 1))]); return out; }
  function dens(pts) { // add points along long segments so distances are not fooled by sparse points
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      out.push(pts[i]);
      if (i + 1 < pts.length) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], d = Math.hypot(bx - ax, by - ay), k = Math.floor(d / 4); for (let j = 1; j <= k; j++) out.push([ax + (bx - ax) * j / (k + 1), ay + (by - ay) * j / (k + 1)]); }
    }
    return out;
  }
  function minDist(a, b) { let m = 1e9; for (const [ax, ay] of a) for (const [bx, by] of b) { const d = Math.hypot(ax - bx, ay - by); if (d < m) m = d; } return m; }

  /* ---------- picture of one letter for the network ---------- */
  function render(strokes) {
    const pts = strokes.flat(); const b = bboxOf(pts);
    const size0 = Math.max(b.w, b.h, 1), lw = 0.11 * size0, size = size0 + lw;
    const s = 20 / size, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const cv = (root.document ? root.document.createElement('canvas') : null); cv.width = 28; cv.height = 28;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const draw = (ox, oy) => {
      ctx.clearRect(0, 0, 28, 28); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.fillStyle = '#000'; ctx.lineWidth = lw * s;
      for (const st of strokes) {
        ctx.beginPath();
        st.forEach(([x, y], i) => { const X = 14 + ox + (x - cx) * s, Y = 14 + oy + (y - cy) * s; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
        if (st.length === 1) ctx.lineTo(14 + ox + (st[0][0] - cx) * s + .01, 14 + oy + (st[0][1] - cy) * s);
        ctx.stroke();
      }
    };
    draw(0, 0);
    let d = ctx.getImageData(0, 0, 28, 28).data, m = 0, mx = 0, my = 0;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) { const a = d[(y * 28 + x) * 4 + 3] / 255; m += a; mx += a * x; my += a * y; }
    if (m > 0) { draw(Math.round(14 - mx / m), Math.round(14 - my / m)); d = ctx.getImageData(0, 0, 28, 28).data; }
    const out = new Float32Array(784); for (let i = 0; i < 784; i++) out[i] = d[i * 4 + 3] / 255;
    return out;
  }

  /* ---------- reading a whole piece of writing ---------- */
  const PAIRS = { c: 'C', o: 'O', s: 'S', v: 'V', w: 'W', x: 'X', z: 'Z', u: 'U', y: 'Y', p: 'P' }; // same shape, only the size tells big from small
  const DESC = new Set(['g', 'j', 'p', 'q', 'y']);
  const SMALLSET = new Set(['a', 'c', 'e', 'm', 'n', 'o', 'r', 's', 'u', 'v', 'w', 'x', 'z']);

  function read(strokes0, padW, padH, opts) {
    opts = opts || {};
    const strokes = strokes0.filter(s => s && s.length);
    if (!strokes.length) return { text: '', chars: [] };
    const guide = { top: .25 * padH, mid: .5 * padH, base: .75 * padH };
    const xhDefault = guide.base - guide.mid;
    const tiny = (opts.tinyFrac || 0.10) * padH, join = (opts.joinFrac || 0.045) * padH;

    // 1. group strokes into letters
    const info = strokes.map((s, i) => { const b = bboxOf(s); return { i, pts: s, b, d: thin(dens(s), 50), tiny: Math.max(b.w, b.h) < tiny }; });
    const big = info.filter(s => !s.tiny), dots = info.filter(s => s.tiny);
    const parent = big.map((_, k) => k); const find = k => parent[k] === k ? k : (parent[k] = find(parent[k]));
    for (let a = 0; a < big.length; a++) for (let b = a + 1; b < big.length; b++) {
      const A = big[a].b, B = big[b].b;
      if (A.x1 + join < B.x0 || B.x1 + join < A.x0) continue; // clearly apart sideways
      if (minDist(big[a].d, big[b].d) <= join) parent[find(a)] = find(b);
    }
    const gmap = {}; big.forEach((s, k) => { (gmap[find(k)] = gmap[find(k)] || []).push(s); });
    let groups = Object.values(gmap).map(list => ({ strokes: list.map(s => s.pts), d: list.flatMap(s => s.d), b: bboxOf(list.flatMap(s => s.pts)) }));
    const marks = [];
    // small marks: dot of i/j, dot of ? or !, or a full stop / apostrophe on its own
    dots.forEach(d => {
      const cx = (d.b.x0 + d.b.x1) / 2, cy = (d.b.y0 + d.b.y1) / 2;
      // a small piece that touches a letter is part of that letter (a wobble or a short stroke), not a dot or full stop
      const touch = groups.find(g => minDist(d.d, g.d) <= 0.8 * join);
      if (touch) { touch.strokes.push(d.pts); touch.d = touch.d.concat(d.d); touch.b = bboxOf(touch.strokes.flat()); return; }
      let best = null, bd = 1e9;
      groups.forEach(g => { const inx = cx >= g.b.x0 - .06 * padH && cx <= g.b.x1 + .06 * padH; if (!inx) return; const dy = cy < g.b.y0 ? g.b.y0 - cy : (cy > g.b.y1 ? cy - g.b.y1 : 0); if (dy < bd && dy < .3 * padH) { bd = dy; best = g; } });
      if (best) {
        const above = cy < best.b.y0 + .25 * best.b.h, below = cy > best.b.y1 - .15 * best.b.h;
        const tall = best.b.h > 0.7 * (guide.base - guide.top) * 0.9;
        if (above && !below) { best.strokes.push(d.pts); best.b = bboxOf(best.strokes.flat()); return; }              // i, j
        if (below && best.b.h > 1.2 * xhDefault * 0.8 && Math.abs(cx - (best.b.x0 + best.b.x1) / 2) < .6 * Math.max(best.b.w, .12 * padH)) { best.strokes.push(d.pts); best.b = bboxOf(best.strokes.flat()); return; } // ? !
      }
      marks.push({ cx, cy, b: d.b, pts: d.pts });
    });

    // 2. read each letter
    groups.sort((a, b) => a.b.x0 - b.b.x0);
    const chars = groups.map(g => {
      const p = classify(render(g.strokes));
      const cls = M.classes;
      const prob = {}; cls.forEach((c, i) => { prob[c] = p[i]; });
      // merge same-shape pairs
      Object.keys(PAIRS).forEach(lo => { const up = PAIRS[lo]; if (prob[up] != null) { prob[lo] = (prob[lo] || 0) + prob[up]; delete prob[up]; } });
      const alt = Object.entries(prob).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return { g, b: g.b, ch: alt[0][0], conf: alt[0][1], alt, strokes: g.strokes.length };
    });
    // hyphen: one flat, wide stroke
    chars.forEach(c => { if (c.strokes === 1 && c.b.h < 0.12 * padH && c.b.w > 2.2 * c.b.h && c.b.w < 0.5 * padH && (c.b.y0 + c.b.y1) / 2 > guide.mid - .1 * padH) { c.ch = '-'; c.conf = 0.8; c.alt = [['-', .8]]; } });

    // 3. size of writing: find x-height and the baseline from the small letters
    const refs = chars.filter(c => SMALLSET.has(c.ch) && c.b.h > 0.6 * xhDefault * 0.5);
    let xh = xhDefault, base = guide.base;
    if (refs.length >= 3) {
      const hs = refs.map(c => c.b.h).sort((a, b) => a - b), bs = refs.map(c => c.b.y1).sort((a, b) => a - b);
      xh = hs[Math.floor(hs.length / 2)]; base = bs[Math.floor(bs.length / 2)];
      // a few capitals among them would raise the median: use the lower half
      xh = hs[Math.floor((hs.length - 1) * 0.4)];
    } else if (opts.xh) { xh = opts.xh; base = opts.base || base; }
    const firstX = Math.min(...chars.map(c => c.b.x0));
    chars.forEach(c => {
      const h = c.b.h, w = c.b.w, thr = c.b.x0 === firstX ? 1.18 : 1.3; // the first letter of a sentence is usually big
      if (PAIRS[c.ch] || c.ch === 'I') {
        const lowerKey = c.ch;
        if (c.ch === 'I') { c.ch = 'I'; return; } // decided below (I or l)
        let cap;
        if (DESC.has(lowerKey)) { const dropBelow = (c.b.y1 - base) / xh; cap = dropBelow < 0.3 && h > (thr + 0.1) * xh; }
        else cap = h > thr * xh;
        c.ch = cap ? PAIRS[lowerKey] : lowerKey;
      }
    });

    // 4. spaces, full stops and everything in order
    const items = chars.map(c => ({ x0: c.b.x0, x1: c.b.x1, c }));
    marks.forEach(m => {
      const nearBase = m.cy > base - 0.6 * xh;
      const ch = nearBase ? '.' : "'";
      items.push({ x0: m.b.x0, x1: m.b.x1, c: { ch, conf: .7, alt: [[ch, .7]], b: m.b, mark: true } });
    });
    items.sort((a, b) => a.x0 - b.x0);
    // single vertical stroke: I (capital i) or l (small L)
    items.forEach((it, k) => {
      const c = it.c; if (c.ch !== 'I' || c.mark) return;
      const prev = items[k - 1], next = items[k + 1];
      const gapL = prev ? it.x0 - prev.x1 : 1e9, gapR = next ? next.x0 - it.x1 : 1e9, sp = Math.max(0.9 * xh, 0.18 * padH);
      const alone = gapL > sp && gapR > sp, first = k === 0;
      c.ch = (alone || first) && c.b.h > 1.3 * xh ? 'I' : (c.b.h > 1.3 * xh ? 'l' : 'I');
      if (!first && !alone) c.ch = 'l';
    });
    // I (capital i) and l (small L) look the same: if a word is only a real word with l, use l (opts.lexicon = Set of lower-case words)
    if (opts.lexicon) {
      const toks = []; let cur = [];
      items.forEach(it => { if (it.c.ch === 'I' && !it.c.mark) cur.push(it); });
      const word = it0 => it0;
      // rebuild word by word
      let wstart = 0;
      const seq = items.map((it, k) => ({ it, k }));
      let w = [];
      const flush = () => {
        if (w.length > 1) {
          const letters = w.map(x => x.it.c.ch).join('');
          const idx = w.map((x, i) => (x.it.c.ch === 'I' ? i : -1)).filter(i => i >= 0 && w.length > 1);
          if (idx.length && !opts.lexicon.has(letters.toLowerCase().replace(/[^a-z']/g, ''))) {
            const arr = letters.split('');
            idx.forEach(i => { arr[i] = 'l'; });
            if (opts.lexicon.has(arr.join('').toLowerCase().replace(/[^a-z']/g, ''))) idx.forEach(i => { w[i].it.c.ch = 'l'; });
          }
        }
        w = [];
      };
      items.forEach((it, k) => {
        if (k > 0) { const gap = it.x0 - items[k - 1].x1; if (gap > Math.max(0.9 * xh, 0.18 * padH)) flush(); }
        w.push({ it }); });
      flush();
    }
    let text = ''; const out = [];
    items.forEach((it, k) => {
      if (k > 0) { const gap = it.x0 - items[k - 1].x1; const punct = it.c.mark && it.c.ch === '.'; if (gap > Math.max(0.9 * xh, 0.18 * padH) && !punct && !(it.c.mark && it.c.ch === "'")) { text += ' '; out.push({ ch: ' ', conf: 1, alt: [], box: null }); } }
      text += it.c.ch; out.push({ ch: it.c.ch, conf: it.c.conf, alt: it.c.alt, box: it.c.b });
    });
    return { text, chars: out, xh, base, groups: groups.length };
  }

  root.Recognizer = {
    load(url) {
      return fetch(url).then(r => r.json()).then(j => {
        M = { classes: j.classes }; ['c1', 'c2', 'c3', 'c4', 'f1', 'f2'].forEach(k => { M[k] = prep(j[k]); });
        return true;
      });
    },
    ready: () => !!M, read
  };
})(typeof window !== 'undefined' ? window : globalThis);
