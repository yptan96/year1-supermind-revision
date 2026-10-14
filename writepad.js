/* Writing pad widget: an answer box + a pad the pupil writes on with a finger / stylus / mouse.
   Every letter or word written is read on the phone (recognize.js) and added to the answer box as typed text.
   Spaces are only added when the pupil taps Space. The answer box can also be typed in.
   WritePad.mount(hostElement, { lexicon:Set, text:'', onChange:fn(text) })  ->  { getText(), setText(t), clear(), flush(), destroy() } */
(function (root) {
  'use strict';
  const CSS = `
.wp{-webkit-user-select:none;user-select:none}
.wp-l{display:block;font-weight:800;margin:12px 0 6px}
.wp-answer{position:relative;min-height:126px;border:3px solid #26264A;border-radius:14px;background:#fff;padding:4px 10px}
.wp-answer textarea{width:calc(100% - 56px);height:116px;border:0;outline:0;background:transparent;font-family:'Nunito',system-ui,sans-serif;font-size:26px;font-weight:700;resize:none;color:#26264A;-webkit-user-select:text;user-select:text}
.wp-status{font-size:14px;font-weight:800;color:#4A4A6A;min-height:20px;margin-top:6px}
.wp-pad{width:100%;height:240px;border:3px solid #26264A;border-radius:14px;touch-action:none;display:block;background:#fff}
.wp button{min-height:52px;border-radius:16px;border:3px solid #26264A;background:#fff;font:800 18px 'Nunito',system-ui,sans-serif;cursor:pointer;color:#26264A;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.wp-bk{position:absolute;right:6px;bottom:6px;min-height:44px !important;padding:0 10px !important;border-radius:12px !important}
.wp-tools{display:flex;gap:6px;flex-wrap:nowrap;margin-top:12px}
.wp-tools button{flex:1 1 0;min-width:0;padding:0 4px;font-size:17px}
.wp-tools .wp-rub{flex:1.5 1 0}
.wp-tools button.on{background:#FFD43B}
`;
  function injectCss() { if (document.getElementById('wp-css')) return; const s = document.createElement('style'); s.id = 'wp-css'; s.textContent = CSS; document.head.appendChild(s); }

  function mount(host, opts) {
    opts = opts || {}; injectCss();
    host.innerHTML = `<div class="wp">
 <label class="wp-l">Write here.</label>
 <div class="wp-answer"><textarea lang="en" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" aria-label="Your answer. Write on the pad below, or type here."></textarea>
  <button class="wp-bk" type="button" aria-label="Delete the last letter"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#26264A" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12z"/><path d="m13 9 5 6M18 9l-5 6"/></svg></button></div>
 <div class="wp-status" aria-live="polite">Getting ready...</div>
 <label class="wp-l">Write on the pad. Tap Space between words.</label>
 <canvas class="wp-pad" aria-label="Writing pad"></canvas>
 <div class="wp-tools">
  <button class="wp-sp" type="button">Space</button>
  <button class="wp-rub" type="button" aria-pressed="false"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#26264A" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M7 21h12"/><path d="M5.5 14.5 14 6a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L11 19.5H8L5.5 17a1.8 1.8 0 0 1 0-2.5z"/><path d="m9 9 6 6"/></svg>Rubber</button>
  <button class="wp-cl" type="button">Clear</button>
 </div></div>`;
    const q = s => host.querySelector(s);
    const ans = q('textarea'), status = q('.wp-status'), pad = q('.wp-pad'), px = pad.getContext('2d');
    let strokes = [], cur = null, erasing = false, timer = null, W = 300, H = 240, down = false, dead = false;
    if (opts.text) ans.value = opts.text;
    const changed = () => { if (opts.onChange) opts.onChange(ans.value); };
    const setStatus = t => { status.textContent = t; };

    function fit() {
      if (dead) return; const r = pad.getBoundingClientRect(); if (!r.width) return; const d = window.devicePixelRatio || 1;
      W = r.width; H = r.height; pad.width = Math.round(W * d); pad.height = Math.round(H * d); px.setTransform(d, 0, 0, d, 0, 0); redraw();
    }
    function redraw() {
      px.clearRect(0, 0, W, H);
      // four-line writing paper: top line, dotted x-height line, baseline (solid, darker), bottom line
      const L = [.14, .40, .66, .92].map(f => Math.round(H * f) + .5);
      px.setLineDash([]); px.lineWidth = 2; px.strokeStyle = '#B7D6F5';
      [L[0], L[3]].forEach(y => { px.beginPath(); px.moveTo(8, y); px.lineTo(W - 8, y); px.stroke(); });
      px.setLineDash([7, 6]); px.beginPath(); px.moveTo(8, L[1]); px.lineTo(W - 8, L[1]); px.stroke();
      px.setLineDash([]); px.lineWidth = 3; px.strokeStyle = '#6FA8E8'; px.beginPath(); px.moveTo(8, L[2]); px.lineTo(W - 8, L[2]); px.stroke();
      px.lineCap = 'round'; px.lineJoin = 'round'; px.lineWidth = 7; px.strokeStyle = '#26264A';
      strokes.concat(cur ? [cur] : []).forEach(s => { px.beginPath(); s.forEach(([x, y], k) => k ? px.lineTo(x, y) : px.moveTo(x, y)); if (s.length === 1) px.lineTo(s[0][0] + .1, s[0][1]); px.stroke(); });
    }
    const onResize = () => fit(); window.addEventListener('resize', onResize); fit();
    setTimeout(fit, 50);
    const pt = e => { const r = pad.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    ['touchstart', 'touchmove', 'touchend'].forEach(t => pad.addEventListener(t, e => e.preventDefault(), { passive: false })); // the page must not scroll while writing
    function eraseAt([x, y]) { const n = strokes.length; strokes = strokes.filter(s => !s.some(([a, b]) => Math.hypot(a - x, b - y) < 24)); if (strokes.length !== n) redraw(); }
    pad.addEventListener('pointerdown', e => { e.preventDefault(); clearTimeout(timer); try { pad.setPointerCapture(e.pointerId); } catch (x) {} down = true; if (erasing) { cur = null; eraseAt(pt(e)); return; } cur = [pt(e)]; redraw(); });
    pad.addEventListener('pointermove', e => { if (!down) return; if (erasing) { eraseAt(pt(e)); return; } if (cur) { cur.push(pt(e)); redraw(); } });
    const endStroke = () => { if (!down) return; down = false; if (cur) { strokes.push(cur); cur = null; redraw(); } if (strokes.length && !erasing) { setStatus('Writing... it will appear in a moment.'); timer = setTimeout(commit, 1800); } };
    ['pointerup', 'pointercancel'].forEach(t => pad.addEventListener(t, endStroke));

    function commit() {
      clearTimeout(timer); if (!strokes.length) return;
      if (!root.Recognizer || !root.Recognizer.ready()) { setStatus('Still getting ready. Try again in a moment.'); timer = setTimeout(commit, 1200); return; }
      const r = root.Recognizer.read(strokes, W, H, { lexicon: opts.lexicon, noSpaces: true });
      if (opts.debug) opts.debug(r, strokes.length, W, H);
      if (r.text) {
        let t = r.text; if (t === 'I' && /[A-Za-z]$/.test(ans.value)) t = 'l'; // a lone upright stroke after a letter is an l (ball)
        ans.value += t; setStatus('Added: ' + t); changed();
      } else setStatus('I could not read that. Try again.');
      strokes = []; cur = null; redraw();
    }
    q('.wp-sp').onclick = () => { commit(); if (ans.value && !/\s$/.test(ans.value)) { ans.value += ' '; changed(); } setStatus('Space added.'); };
    q('.wp-bk').onclick = () => { if (strokes.length) { strokes = []; redraw(); clearTimeout(timer); setStatus('Ready.'); return; } ans.value = ans.value.slice(0, -1); changed(); };
    q('.wp-rub').onclick = e => { erasing = !erasing; const b = q('.wp-rub'); b.classList.toggle('on', erasing); b.setAttribute('aria-pressed', erasing); clearTimeout(timer); if (!erasing && strokes.length) timer = setTimeout(commit, 1800); };
    q('.wp-cl').onclick = () => api.clear();
    ans.addEventListener('input', changed);
    if (root.Recognizer && root.Recognizer.ready()) setStatus('Ready. Write on the pad.');
    else if (root.Recognizer) root.Recognizer.load('models/letters.json').then(() => setStatus('Ready. Write on the pad.')).catch(() => setStatus('The handwriting reader could not load. You can still type.'));

    const api = {
      getText: () => ans.value,
      setText: t => { ans.value = t; changed(); },
      clear: () => { clearTimeout(timer); strokes = []; cur = null; redraw(); ans.value = ''; setStatus('Ready.'); changed(); },
      flush: () => commit(),
      setStatus,
      destroy: () => { dead = true; clearTimeout(timer); window.removeEventListener('resize', onResize); host.innerHTML = ''; }
    };
    return api;
  }
  root.WritePad = { mount };
})(window);
