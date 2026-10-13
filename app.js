/* Year 1 English Practice - Units 0 to 4 (Super Minds 1 / KSSR BI Year 1 SJK)
   Layers: content (data.js) -> game engines (below) -> login/session (edu-game-login-page) -> student/teacher views (edu-game-teacher-tools). */
(function () {
'use strict';

const C = window.CONTENT, UNITS = C.units, SKILLS = C.skills;
const SKILL = {}; SKILLS.forEach(s => SKILL[s.id] = s);
const itemById = {}, sentById = {};
UNITS.forEach(u => { u.items.forEach(i => itemById[i.id] = i); u.sentences.forEach(s => sentById[s.id] = s); });
const ALL_ITEMS = UNITS.flatMap(u => u.items);

// Keep in sync with api/comment.js and api/clear-results.js. CHANGE BEFORE REAL PUPILS USE IT.
const TEACHER_PIN = '1234';
const SESSION_KEY = 'eduAppSession_v1';
const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours
const LOCAL_KEY = 'eduResultsLocal_v1';
const ROUND = 10; // fixed round size: every percentage divides by this (or by pair count for Words)
const LEVEL_NAME = ['Easy', 'Medium', 'Hard'];
const MIX_BG = '#E5DBFF';

let currentStudent = null, sessionResults = [], teacherPin = null;
let view = 'home';
let sel = { units: [0], skill: 'listen', level: 1 };
let G = null;
let teacherClassFilter = '';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sample(arr, n) { const out = []; let bag = []; while (out.length < n) { if (!bag.length) { bag = shuffle(arr); if (out.length && bag[bag.length - 1] === out[out.length - 1] && bag.length > 1) bag.unshift(bag.pop()); } out.push(bag.pop()); } return out; }
const itemsOf = us => us.flatMap(u => UNITS[u].items);
const sentsOf = us => us.flatMap(u => UNITS[u].sentences);
const label = it => it.kind === 'action' ? it.cmd : it.en;
const tokens = s => s.en.split(' ');
const formatTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- sound ---------- */
const aud = new Audio();
function say(lang, id) { try { aud.pause(); aud.src = 'audio/' + lang + '/' + id + '.mp3'; aud.play().catch(() => {}); } catch (e) {} }
let actx;
function beep(ok) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(); o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime; o.type = 'sine';
    if (ok) { o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + .12); } else { o.frequency.setValueAtTime(200, t); }
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.start(t); o.stop(t + .32);
  } catch (e) {}
}
function showToast(message, isError = false) {
  const t = document.createElement('div'); t.className = 'toast-message' + (isError ? ' error' : ''); t.textContent = message;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
}
const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 010 6"/><path d="M19 6a8 8 0 010 12"/></svg>';
const spkBtn = (act, data, aria) => '<button class="spk" data-act="' + act + '" ' + (data || '') + ' aria-label="' + aria + '">' + SPK + '</button>';

function pic(it, cls) {
  if (it.kind === 'number') return '<div class="numtile">' + it.num + '</div>';
  return '<img src="img/' + it.img + '.png" alt="' + esc(it.en) + '"' + (cls ? ' class="' + cls + '"' : '') + '>';
}

/* ---------- TP (DSKP Performance Level), derived from % at render time ---------- */
function pct2tp(p) { return p >= 90 ? 6 : p >= 75 ? 5 : p >= 60 ? 4 : p >= 45 ? 3 : p >= 30 ? 2 : 1; }
const parseSlug = g => { const m = /^(u\d|mix)-([a-z]+)-s(\d)$/.exec(g || ''); return m ? { unit: m[1], skill: m[2], level: +m[3] } : null; };
const bestPct = recs => recs.reduce((b, r) => Math.max(b, r.percentage || 0), 0);
const tpDesc = (dskp, tp) => (C.tpDescriptors[dskp] && C.tpDescriptors[dskp][tp]) || '';
// Per DSKP skill, based on each pupil's best attempt per game (skill), then averaged across the games under that DSKP skill.
function dskpTPs(records) {
  const by = {};
  records.forEach(r => { const p = parseSlug(r.game); if (!p || p.skill === 'speak') return; (by[p.skill] = by[p.skill] || []).push(r); });
  const out = {}, pcts = {};
  ['Listening', 'Reading', 'Writing'].forEach(d => {
    const ids = SKILLS.filter(s => s.dskp === d && s.id !== 'speak').map(s => s.id).filter(id => by[id]);
    if (!ids.length) { out[d] = null; return; }
    const tps = ids.map(id => pct2tp(bestPct(by[id])));
    out[d] = Math.round(tps.reduce((a, b) => a + b, 0) / tps.length);
    pcts[d] = Math.round(ids.reduce((a, id) => a + bestPct(by[id]), 0) / ids.length);
  });
  const have = Object.values(out).filter(x => x != null);
  out.overall = have.length ? Math.round(have.reduce((a, b) => a + b, 0) / have.length) : null;
  out.pcts = pcts;
  return out;
}
const tpBadge = (tp, sub) => tp == null ? '<span class="tpb tp0">-</span>' : '<span class="tpb tp' + tp + '">TP' + tp + (sub != null ? '<small>' + sub + '%</small>' : '') + '</span>';

/* ---------- results store ---------- */
const resultsStore = {
  _local() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (e) { return []; } },
  async save(rec) {
    const stamped = Object.assign({}, rec, { timestamp: new Date().toISOString() });
    try { const l = this._local(); l.push(stamped); localStorage.setItem(LOCAL_KEY, JSON.stringify(l.slice(-300))); } catch (e) {}
    try {
      const r = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
      return r.ok;
    } catch (e) { return false; }
  },
  async load() {
    try {
      const r = await fetch('/api/leaderboard');
      if (!r.ok) throw new Error('no storage');
      const data = await r.json();
      return { records: Array.isArray(data) ? data : [], remote: true };
    } catch (e) { return { records: this._local(), remote: false }; }
  }
};

/* ---------- session (edu-game-login-page) ---------- */
function saveSession() {
  if (!currentStudent) return;
  const s = { student: currentStudent, sel, view: view === 'game' || view === 'result' ? view : 'home', G, sessionResults, savedAt: Date.now() };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY); if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.savedAt || Date.now() - s.savedAt > SESSION_MAX_AGE_MS) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch (e) { return null; }
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

/* ---------- question builders ---------- */
function distract(it, pool, n) {
  const ok = x => x.id !== it.id && x.en !== it.en;
  const same = shuffle(pool.filter(x => ok(x) && x.kind === it.kind));
  const rest = shuffle(pool.filter(x => ok(x) && x.kind !== it.kind));
  let out = [...same, ...rest];
  if (out.length < n) { const more = shuffle(ALL_ITEMS.filter(x => ok(x) && !out.includes(x) && x.kind === it.kind)); out = out.concat(more); }
  if (out.length < n) out = out.concat(shuffle(ALL_ITEMS.filter(x => ok(x) && !out.includes(x))));
  return out.slice(0, n);
}
const ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');
function otherLetters(not, n) { return shuffle(ALPHA.filter(c => !not.includes(c))).slice(0, n); }

function buildQs(skill, us, level) {
  const L = level - 1;
  if (skill === 'listen') {
    const pool = itemsOf(us), n = [3, 4, 6][L];
    return sample(pool, ROUND).map(it => ({ k: 'tap', id: it.id, opts: shuffle([it, ...distract(it, pool, n - 1)]).map(x => x.id) }));
  }
  if (skill === 'read') {
    const pool = itemsOf(us);
    if (level === 3) {
      const ss = sentsOf(us).filter(s => s.item);
      return sample(ss, ROUND).map(s => { const it = itemById[s.item]; return { k: 's2p', sid: s.id, id: it.id, opts: shuffle([it, ...distract(it, pool, 3)]).map(x => x.id) }; });
    }
    return sample(pool, ROUND).map(it => ({ k: level === 1 ? 'w2p' : 'p2w', id: it.id, opts: shuffle([it, ...distract(it, pool, 3)]).map(x => x.id) }));
  }
  if (skill === 'write') {
    const pool = itemsOf(us).filter(i => i.spell), ex = [0, 2, 3][L];
    return sample(pool, ROUND).map(it => { const w = it.en.split(''); return { k: 'spell', id: it.id, tiles: shuffle([...w, ...otherLetters(w, ex)]) }; });
  }
  if (skill === 'sent') {
    let pool = sentsOf(us).filter(s => tokens(s).length >= 3);
    if (level === 1) { const p1 = pool.filter(s => tokens(s).length <= 4); if (p1.length >= 3) pool = p1; }
    const allTok = sentsOf([0, 1, 2, 3, 4]).flatMap(tokens);
    return sample(pool, ROUND).map(s => {
      const tk = tokens(s); let tiles = tk.slice();
      if (level === 3) { const extra = shuffle(allTok.filter(t => !tk.includes(t) && t.toLowerCase() !== tk[0].toLowerCase()))[0]; if (extra) tiles.push(extra); }
      let sh = shuffle(tiles), tries = 0; while (sh.join(' ') === tk.join(' ') && tries++ < 8) sh = shuffle(tiles);
      return { k: 'order', sid: s.id, tiles: sh, n: tk.length };
    });
  }
  if (skill === 'sound') {
    const pool = itemsOf(us).filter(i => i.spell);
    return sample(pool, ROUND).map(it => {
      const w = it.en; let mode = 'first', pos = 0;
      if (level === 2) mode = Math.random() < .5 ? 'first' : 'last';
      if (level === 3) { mode = 'miss'; pos = 1 + Math.floor(Math.random() * (w.length - 1)); }
      if (mode === 'last') pos = w.length - 1;
      const ans = w[pos], n = level === 1 ? 3 : 4;
      return { k: 'letter', id: it.id, mode, pos, ans, opts: shuffle([ans, ...otherLetters([ans], n - 1)]) };
    });
  }
  if (skill === 'speak') {
    const items = itemsOf(us), sents = sentsOf(us);
    if (level === 1) return sample(items, ROUND).map(it => ({ k: 'say', ref: 'i', id: it.id }));
    if (level === 2) return sample(sents, ROUND).map(s => ({ k: 'say', ref: 's', id: s.id }));
    return shuffle([...sample(items, 5).map(it => ({ k: 'say', ref: 'i', id: it.id })), ...sample(sents, 5).map(s => ({ k: 'say', ref: 's', id: s.id }))]);
  }
  return [];
}
const newSt = () => ({ placed: [], wrongs: [], solved: false, tried: false, flash: false, shakeTile: -1, heard: false, said: false, lang: '' });

function startGame() {
  const us = sel.units.slice().sort((a, b) => a - b);
  G = { skill: sel.skill, units: us, level: sel.level, idx: 0, res: [], mist: [], t0: Date.now(), done: false, saved: false, st: newSt(), result: null };
  if (G.skill === 'words') {
    const pairs = [4, 6, 8][G.level - 1];
    const pool = itemsOf(us).filter(i => i.kind !== 'action' && i.en.length <= 12);
    const seen = new Set(), uniq = shuffle(pool).filter(i => (seen.has(i.en) ? false : (seen.add(i.en), true)));
    const chosen = uniq.slice(0, pairs);
    const cards = shuffle(chosen.flatMap(i => [{ pid: i.id, t: 'pic', up: false, done: false }, { pid: i.id, t: 'word', up: false, done: false }]));
    G.mem = { pairs: chosen.length, cards, up: [], mism: [], lock: false };
  } else {
    G.qs = buildQs(G.skill, us, G.level);
  }
  view = 'game'; saveSession(); render(); autoplay();
}
function addMistake(text) { if (!G.mist.includes(text)) G.mist.push(text); }
function qLabel(q) {
  if (q.sid && q.k === 'order') return sentById[q.sid].en;
  if (q.sid) return sentById[q.sid].en;
  return label(itemById[q.id]);
}
function autoplay() {
  if (!G || view !== 'game' || G.skill === 'words') return;
  const q = G.qs[G.idx]; if (!q) return;
  setTimeout(() => {
    if (q.k === 'tap' || q.k === 'spell' || q.k === 'letter') say('en', q.id);
    else if (q.k === 'order') say('en', q.sid);
    else if (q.k === 'say') say('en', q.id);
  }, 250);
}

/* ---------- finishing a round ---------- */
function finishGame() {
  let score, total;
  if (G.skill === 'words') { total = G.mem.pairs; score = Math.max(0, total - G.mem.mism.length); }
  else { total = ROUND; score = G.res.filter(x => x === 1).length; }
  const key = G.units.length === 1 ? 'u' + G.units[0] : 'mix';
  const rec = {
    name: currentStudent.name, className: currentStudent.className,
    game: key + '-' + G.skill + '-s' + G.level,
    score, total, percentage: Math.round(score / total * 100),
    timeSeconds: Math.min(3600, Math.round((Date.now() - G.t0) / 1000)),
    mistakes: G.mist.slice(0, 20)
  };
  G.done = true; G.result = rec;
  if (!G.saved) { G.saved = true; resultsStore.save(rec); sessionResults.push(rec); }
  view = 'result'; saveSession(); render();
}

/* ---------- rendering ---------- */
function unitTag() {
  if (G.units.length === 1) { const u = UNITS[G.units[0]]; return '<span class="gtag" style="background:' + u.bg + '">' + u.short + ' ' + esc(u.name) + '</span>'; }
  return '<span class="gtag" style="background:' + MIX_BG + '">' + (G.units.length === 5 ? 'All units' : G.units.map(u => 'Unit ' + u).join(', ')) + '</span>';
}
function render() {
  const stage = $('stage'); if (!stage) return;
  ['homeBtn', 'studentViewBtn', 'teacherViewBtn'].forEach(id => $(id).classList.remove('on'));
  if (view === 'home') { $('homeBtn').classList.add('on'); stage.innerHTML = renderHome(); }
  else if (view === 'game') stage.innerHTML = renderGame();
  else if (view === 'result') stage.innerHTML = renderResult();
  else if (view === 'student') { $('studentViewBtn').classList.add('on'); renderStudent(); }
  else if (view === 'teacher') { $('teacherViewBtn').classList.add('on'); renderTeacher(); }
}

function renderHome() {
  const all = sel.units.length === 5;
  const units = UNITS.map(u => '<button class="unit-btn' + (sel.units.includes(u.id) && !all ? ' on' : (all ? ' on' : '')) + '" style="background:' + u.bg + '" data-act="unit" data-u="' + u.id + '" aria-pressed="' + sel.units.includes(u.id) + '">' +
    '<span class="u1">' + u.short + '</span><span>' + esc(u.name) + '</span><span class="u3">' + esc(u.sub) + '</span></button>').join('') +
    '<button class="unit-btn' + (all ? ' on' : '') + '" style="background:' + MIX_BG + '" data-act="unit" data-u="all"><span class="u1">All</span><span>All Units</span><span class="u3">Unit 0 to 4</span></button>';
  const skills = SKILLS.map(s => '<button class="skill-btn' + (sel.skill === s.id ? ' on' : '') + '" data-act="skill" data-s="' + s.id + '">' + s.label + '</button>').join('');
  const levels = [1, 2, 3].map(l => '<button class="level-btn' + (sel.level === l ? ' on' : '') + '" data-act="level" data-l="' + l + '">' + '&#9733;'.repeat(l) + ' Star ' + l + '<small>' + LEVEL_NAME[l - 1] + '</small></button>').join('');
  const names = sel.units.slice().sort((a, b) => a - b).map(i => 'Unit ' + i + ' ' + UNITS[i].name).join(', ');
  return '<div class="home"><h2>What do you want to play today?</h2>' +
    '<p class="label">1. Pick a unit (you can pick more than one)</p><div class="units">' + units + '</div>' +
    '<p class="label">2. What do you want to do?</p><div class="skills">' + skills + '</div>' +
    '<div class="home-foot"><div><p class="label">3. Pick your level</p><div class="levels">' + levels + '</div></div>' +
    '<button class="btn btn-green" data-act="start">Start</button></div>' +
    '<p class="summary">You picked: ' + esc(all ? 'All Units' : names) + ' &middot; ' + SKILL[sel.skill].label + ' &middot; Star ' + sel.level + '</p></div>';
}

const PROMPTS = {
  tap: ['Listen. Tap the picture.', ''], w2p: ['Read the word. Tap the picture.', ''], p2w: ['Look at the picture. Tap the word.', ''],
  s2p: ['Read the sentence. Tap the picture.', ''], spell: ['Tap the letters. Spell the word.', ''], order: ['Tap the words. Make a sentence.', ''],
  letter: ['', ''], say: ['Listen. Then say it.', '']
};

function renderGame() {
  const g = G, sk = SKILL[g.skill];
  const total = g.skill === 'words' ? g.mem.pairs : ROUND;
  const done = g.skill === 'words' ? g.mem.cards.filter(c => c.done).length / 2 : g.idx + (g.st.solved || g.st.said ? 1 : 0);
  const head = '<div class="gbar">' + unitTag() + '<span class="gtag" style="background:#fff;border:2px solid var(--ink)">' + sk.label + ' &middot; Star ' + g.level + '</span>' +
    '<div class="progress"><div style="width:' + Math.round(done / total * 100) + '%"></div></div>' +
    '<span class="gcount">' + (g.skill === 'words' ? done + ' / ' + total : Math.min(g.idx + 1, total) + ' / ' + total) + '</span>' +
    '<button class="btn btn-sm btn-pill" data-act="quit">Stop</button></div>';
  if (g.skill === 'words') return head + renderMemory();
  const q = g.qs[g.idx], st = g.st;
  let body = '';
  if (q.k === 'tap') body = bodyPick(q, st, 'tap');
  else if (q.k === 'w2p' || q.k === 's2p' || q.k === 'p2w') body = bodyRead(q, st);
  else if (q.k === 'spell') body = bodySpell(q, st);
  else if (q.k === 'order') body = bodyOrder(q, st);
  else if (q.k === 'letter') body = bodyLetter(q, st);
  else if (q.k === 'say') body = bodySay(q, st);
  return head + body;
}

function optBtn(q, st, id, inner, cls) {
  const wrong = st.wrongs.includes(id), right = st.solved && id === (q.ans || q.id);
  return '<button class="opt ' + (cls || '') + (right ? ' correct' : '') + (wrong ? ' wrong' : '') + '" data-act="pick" data-id="' + esc(id) + '"' + (st.solved || wrong ? ' disabled' : '') + '>' + inner + '</button>';
}
function nextBtn(st, enabled, text) {
  return '<div class="gfoot"><span></span><button class="btn btn-green" data-act="next"' + (enabled ? '' : ' disabled') + '>' + (text || 'Next') + '</button></div>';
}
function feedback(st, okText) {
  if (st.solved) return '<div class="msg ok">' + okText + '</div>';
  if (st.wrongs.length || st.tried) return '<div class="msg no">Oops! Try again.</div>';
  return '<div class="msg"></div>';
}

function bodyPick(q, st) {
  const it = itemById[q.id];
  const opts = q.opts.map(id => optBtn(q, st, id, pic(itemById[id]))).join('');
  const hint = it.kind === 'action' ? it.cmd : it.en;
  return '<div class="prompt">' + spkBtn('play', 'data-id="' + q.id + '"', 'Play the sound again') + '<div><h2>Listen. Tap the picture.</h2><div class="sub">Tap the speaker to hear again.</div></div></div>' +
    '<div class="opts">' + opts + '</div>' + feedback(st, 'Well done! ' + esc(hint)) + nextBtn(st, st.solved);
}
function bodyRead(q, st) {
  if (q.k === 'w2p') {
    const it = itemById[q.id];
    return '<div class="prompt"><div><h2>Read the word. Tap the picture.</h2></div></div>' +
      '<div class="card" style="margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:16px"><div class="bigtext">' + esc(label(it)) + '</div>' + spkBtn('play', 'data-id="' + q.id + '"', 'Hear the word') + '</div>' +
      '<div class="opts">' + q.opts.map(id => optBtn(q, st, id, pic(itemById[id]))).join('') + '</div>' + feedback(st, 'Well done!') + nextBtn(st, st.solved);
  }
  if (q.k === 's2p') {
    const s = sentById[q.sid];
    return '<div class="prompt"><div><h2>Read the sentence. Tap the picture.</h2></div></div>' +
      '<div class="card" style="margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:16px"><div class="bigtext">' + esc(s.en) + '</div>' + spkBtn('play', 'data-id="' + s.id + '"', 'Hear the sentence') + '</div>' +
      '<div class="opts">' + q.opts.map(id => optBtn(q, st, id, pic(itemById[id]))).join('') + '</div>' + feedback(st, 'Well done!') + nextBtn(st, st.solved);
  }
  const it = itemById[q.id];
  return '<div class="prompt"><div><h2>Look at the picture. Tap the word.</h2></div></div>' +
    '<div class="bigpic" style="margin-bottom:14px">' + pic(it) + '</div>' +
    '<div class="opts c2">' + q.opts.map(id => optBtn(q, st, id, esc(label(itemById[id])), 'word')).join('') + '</div>' + feedback(st, 'Well done!') + nextBtn(st, st.solved);
}
function bodySpell(q, st) {
  const it = itemById[q.id], word = it.en;
  const typed = st.placed.map(i => q.tiles[i]);
  const slots = word.split('').map((w, k) => {
    const ch = typed[k] || '';
    const cls = st.solved ? 'good' : (st.flash && ch ? 'bad' : '');
    return '<div class="slot ' + cls + '">' + (!ch && G.level === 1 ? '<span class="guide">' + w + '</span>' : '') + esc(ch) + '</div>';
  }).join('');
  const tiles = q.tiles.map((c, i) => '<button class="tile' + (st.placed.includes(i) ? ' used' : '') + (st.shakeTile === i ? ' shake' : '') + '" data-act="tile" data-i="' + i + '"' + (st.placed.includes(i) || st.solved ? ' disabled' : '') + '>' + esc(c) + '</button>').join('');
  const show = G.level < 3 || st.solved;
  return '<div class="twocol"><div><div class="bigpic">' + (show ? pic(it) : '<div class="numtile" style="color:#B8B2A0">?</div>') + '</div>' +
    '<div style="text-align:center;margin-top:10px">' + spkBtn('play', 'data-id="' + q.id + '"', 'Hear the word') + '</div></div>' +
    '<div><div class="prompt" style="margin-bottom:4px"><h2>Tap the letters. Spell the word.</h2></div><div class="slots">' + slots + '</div>' +
    feedback(st, 'Well done! ' + esc(word)) + '<div class="tiles">' + tiles + '</div>' +
    '<div class="gfoot"><button class="btn btn-pill" data-act="clear"' + (st.solved || !st.placed.length ? ' disabled' : '') + '>Clear</button><button class="btn btn-green" data-act="next"' + (st.solved ? '' : ' disabled') + '>Next</button></div></div></div>';
}
function bodyOrder(q, st) {
  const s = sentById[q.sid], it = s.item ? itemById[s.item] : null;
  const placed = st.placed.map((i, k) => '<button class="tok" data-act="untile" data-k="' + k + '"' + (st.solved ? ' disabled' : '') + '>' + esc(q.tiles[i]) + '</button>').join('');
  const bank = q.tiles.map((t, i) => '<button class="tile small' + (st.placed.includes(i) ? ' used' : '') + '" data-act="tile" data-i="' + i + '"' + (st.placed.includes(i) || st.solved ? ' disabled' : '') + '>' + esc(t) + '</button>').join('');
  const showPic = it && G.level < 3;
  return '<div class="' + (showPic ? 'twocol' : '') + '">' + (showPic ? '<div><div class="bigpic">' + pic(it) + '</div></div>' : '') +
    '<div><div class="prompt">' + spkBtn('play', 'data-id="' + s.id + '"', 'Hear the sentence') + '<div><h2>Tap the words. Make a sentence.</h2><div class="sub">' + (G.level === 3 ? 'Listen. One word is extra.' : 'Tap a word in the box to move it back.') + '</div></div></div>' +
    '<div class="sline' + (st.flash ? ' shake' : '') + '" style="' + (st.solved ? 'border-color:#2B8A3E;background:#D3F9D8' : '') + '">' + (placed || '<span class="note">Your sentence goes here</span>') + '</div>' +
    feedback(st, 'Great! Big letter first. Dot at the end.') + '<div class="tiles">' + bank + '</div>' +
    '<div class="gfoot"><button class="btn btn-pill" data-act="clear"' + (st.solved || !st.placed.length ? ' disabled' : '') + '>Clear</button><button class="btn btn-green" data-act="next"' + (st.solved ? '' : ' disabled') + '>Next</button></div></div></div>';
}
function bodyLetter(q, st) {
  const it = itemById[q.id], w = it.en;
  const shown = w.split('').map((c, k) => (k === q.pos && !st.solved) ? '_' : c).join(' ');
  const ask = q.mode === 'first' ? 'What is the first letter?' : q.mode === 'last' ? 'What is the last letter?' : 'Which letter is missing?';
  const display = q.mode === 'first' || q.mode === 'last' ? shown : shown;
  return '<div class="twocol"><div><div class="bigpic">' + pic(it) + '</div><div style="text-align:center;margin-top:10px">' + spkBtn('play', 'data-id="' + q.id + '"', 'Hear the word') + '</div></div>' +
    '<div><div class="prompt" style="margin-bottom:4px"><h2>' + ask + '</h2></div><div class="bigtext" style="text-align:left;letter-spacing:6px;margin:6px 0 12px">' + esc(display) + '</div>' +
    '<div class="opts" style="grid-template-columns:repeat(auto-fit,minmax(90px,1fr))">' + q.opts.map(c => optBtn(q, st, c, esc(c), 'letter')).join('') + '</div>' +
    feedback(st, 'Well done! ' + esc(w)) + nextBtn(st, st.solved) + '</div></div>';
}
function bodySay(q, st) {
  const isS = q.ref === 's', o = isS ? sentById[q.id] : itemById[q.id];
  const it = isS ? (o.item ? itemById[o.item] : null) : o;
  const text = isS ? o.en : label(o);
  const bm = isS ? o.bm : (o.kind === 'action' ? o.cmdBm : o.bm), zh = isS ? o.zh : (o.kind === 'action' ? o.cmdZh : o.zh);
  const mean = '<div class="meanings"><button class="mean' + (st.lang === 'ms' ? ' on' : '') + '" data-act="mean" data-l="ms">BM' + (st.lang === 'ms' ? ': ' + esc(bm) : '') + '</button>' +
    '<button class="mean' + (st.lang === 'zh' ? ' on' : '') + '" data-act="mean" data-l="zh">中文' + (st.lang === 'zh' ? ': ' + esc(zh) : '') + '</button></div>';
  return '<div class="' + (it ? 'twocol' : '') + '">' + (it ? '<div><div class="bigpic">' + pic(it) + '</div></div>' : '') +
    '<div><div class="label">1. Listen.  2. Say it.  3. Tap "I said it".</div><div class="card" style="display:flex;align-items:center;gap:16px;justify-content:space-between"><div class="bigtext" style="text-align:left">' + esc(text) + '</div>' + spkBtn('play', 'data-id="' + q.id + '"', 'Listen') + '</div>' +
    '<p class="label" style="margin-top:12px">Tap to hear what it means.</p>' + mean +
    '<div class="gfoot"><button class="btn btn-pill' + (st.said ? '' : '') + '" style="' + (st.said ? 'background:#B2F2BB' : '') + '" data-act="said">' + (st.said ? 'I said it &#10003;' : 'I said it') + '</button>' +
    '<button class="btn btn-green" data-act="next"' + (st.said ? '' : ' disabled') + '>Next</button></div></div></div>';
}
function renderMemory() {
  const m = G.mem, n = m.cards.length;
  const cards = m.cards.map((c, i) => {
    const it = itemById[c.pid], up = c.up || c.done;
    const inner = !up ? '?' : (c.t === 'pic' ? pic(it) : esc(it.en));
    return '<button class="mcard' + (c.done ? ' done' : (c.up ? ' up' : '')) + '" data-act="flip" data-i="' + i + '" aria-label="' + (up ? esc(it.en) : 'Hidden card') + '"' + (c.done ? ' disabled' : '') + '>' + inner + '</button>';
  }).join('');
  return '<div class="prompt"><div><h2>Find the pairs.</h2><div class="sub">Match the picture with the word.</div></div></div><div class="mem n' + n + '">' + cards + '</div>';
}

function renderResult() {
  const r = G.result, pct = r.percentage, speak = G.skill === 'speak';
  const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
  const tp = speak ? null : pct2tp(pct);
  const enc = pct >= 90 ? 'Amazing job!' : pct >= 70 ? 'Great work!' : pct >= 50 ? 'Good try! Keep practising.' : "Let's practise more together!";
  const starHtml = [0, 1, 2].map(i => '<span class="' + (i < stars ? '' : 'off') + '">&#9733;</span>').join('');
  return '<div class="result card"><div class="label">ROUND COMPLETE</div><div class="stars" aria-label="' + stars + ' of 3 stars">' + starHtml + '</div>' +
    '<div class="big" style="margin:10px 0">' + r.score + ' / ' + r.total + '</div><div style="font-weight:800;font-size:22px">' + enc + '</div>' +
    '<div style="margin:8px 0;font-weight:700;color:var(--muted)">' + formatTime(r.timeSeconds) + (tp ? ' &middot; ' + tpBadge(tp) : '') + '</div>' +
    (r.mistakes.length ? '<div style="margin:12px 0"><div class="label">Let\'s practise more:</div>' + r.mistakes.map(m => '<span class="practice-chip">' + esc(m) + '</span>').join('') + '</div>' : '<div style="margin:12px 0;font-weight:800;color:#2B8A3E">No mistakes. Awesome!</div>') +
    '<div style="display:flex;flex-direction:column;gap:10px;margin-top:14px"><button class="btn btn-green" data-act="again" style="font-size:24px">Play again</button>' +
    '<button class="btn" data-act="gohome">Pick another game</button><button class="btn" data-act="mine">My Result</button></div></div>';
}

/* ---------- student view ---------- */
function myRecords(all) {
  const n = currentStudent.name.trim().toLowerCase(), c = currentStudent.className.trim().toLowerCase();
  return all.filter(r => String(r.name).trim().toLowerCase() === n && String(r.className).trim().toLowerCase() === c);
}
function starsFor(p) { return p == null ? '<span class="note">-</span>' : (p >= 90 ? '&#9733;&#9733;&#9733;' : p >= 70 ? '&#9733;&#9733;&#9734;' : p >= 40 ? '&#9733;&#9734;&#9734;' : '&#9734;&#9734;&#9734;'); }
async function renderStudent() {
  const stage = $('stage'); stage.innerHTML = '<div class="card">Loading...</div>';
  const { records } = await resultsStore.load();
  if (view !== 'student') return;
  const mine = myRecords(records);
  const tps = dskpTPs(mine);
  const keys = ['u0', 'u1', 'u2', 'u3', 'u4', 'mix'];
  const rows = keys.map(k => {
    const nm = k === 'mix' ? 'Mixed units' : 'Unit ' + k.slice(1) + ' ' + UNITS[+k.slice(1)].name;
    const cells = SKILLS.map(s => {
      const rs = mine.filter(r => { const p = parseSlug(r.game); return p && p.unit === k && p.skill === s.id; });
      return '<td>' + starsFor(rs.length ? bestPct(rs) : null) + '</td>';
    }).join('');
    return '<tr><td>' + esc(nm) + '</td>' + cells + '</tr>';
  }).join('');
  const recent = mine.slice().sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 6);
  const practice = [...new Set(recent.flatMap(r => Array.isArray(r.mistakes) ? r.mistakes : []))].slice(0, 14);
  let comment = '';
  try { const r = await fetch('/api/comment?name=' + encodeURIComponent(currentStudent.name) + '&className=' + encodeURIComponent(currentStudent.className)); if (r.ok) { const j = await r.json(); comment = j.comment || ''; } } catch (e) {}
  const tpRow = [['Listening', 'Listen'], ['Speaking', 'Speak'], ['Reading', 'Read'], ['Writing', 'Write']].map(([d, l]) =>
    '<div class="sumcard" style="text-align:center"><span>' + l + '</span><b>' + (d === 'Speaking' ? '<small style="font-size:14px">with Ms Tan</small>' : (tps[d] ? 'TP' + tps[d] : '-')) + '</b></div>').join('');
  stage.innerHTML = '<h2 style="margin-bottom:10px">My Result</h2>' +
    '<div class="teacher-summary">' + tpRow + '</div>' +
    (comment ? '<div class="card" style="background:#FFF3BF;margin-bottom:14px"><div class="label">Message from your teacher</div><div style="font-weight:800">' + esc(comment) + '</div></div>' : '') +
    '<p class="label">My stars (best score)</p><div class="tbl-wrap"><table><thead><tr><th>Unit</th>' + SKILLS.map(s => '<th>' + s.label + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="card" style="margin-top:14px"><div class="label">Words to practise</div>' + (practice.length ? practice.map(w => '<span class="practice-chip">' + esc(w) + '</span>').join('') : (mine.length ? '<span style="font-weight:800;color:#2B8A3E">No mistakes. Awesome!</span>' : '<span class="note">Play a game to see your words here.</span>')) + '</div>' +
    renderLeaderboard(records);
}
function renderLeaderboard(records) {
  const slugs = [...new Set(records.map(r => r.game).filter(parseSlug))].sort();
  if (!slugs.length) return '<div class="card" style="margin-top:14px"><div class="label">Leaderboard</div><span class="note">No scores yet. Be the first!</span></div>';
  const cur = window._lbSlug && slugs.includes(window._lbSlug) ? window._lbSlug : slugs[0];
  const best = {};
  records.filter(r => r.game === cur).forEach(r => {
    const k = r.name + '__' + r.className, e = best[k];
    if (!e || r.percentage > e.percentage || (r.percentage === e.percentage && (r.timeSeconds ?? 1e9) < (e.timeSeconds ?? 1e9))) best[k] = r;
  });
  const top = Object.values(best).sort((a, b) => b.percentage - a.percentage || (a.timeSeconds ?? 1e9) - (b.timeSeconds ?? 1e9)).slice(0, 10);
  const nice = g => { const p = parseSlug(g); return (p.unit === 'mix' ? 'Mixed units' : 'Unit ' + p.unit.slice(1)) + ' - ' + SKILL[p.skill].label + ' - Star ' + p.level; };
  return '<div class="card" style="margin-top:14px"><div class="label">Leaderboard</div><select id="lbSel" class="form-input" style="min-height:48px;font-size:16px;margin-bottom:10px">' + slugs.map(s => '<option value="' + s + '"' + (s === cur ? ' selected' : '') + '>' + esc(nice(s)) + '</option>').join('') + '</select>' +
    '<table><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Time</th></tr></thead><tbody>' + top.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name) + ' (' + esc(r.className) + ')</td><td>' + r.percentage + '%</td><td>' + (r.timeSeconds != null ? formatTime(r.timeSeconds) : '-') + '</td></tr>').join('') + '</tbody></table></div>';
}

/* ---------- teacher view ---------- */
function suggestComment(name, avg, words) {
  const w = words.length ? ' Keep practising: ' + words.slice(0, 3).join(', ') + '.' : '';
  if (avg >= 90) return 'Excellent work, ' + name + '! You are doing really well. Keep it up!';
  if (avg >= 70) return 'Good job, ' + name + '! You are doing well overall.' + w;
  if (avg >= 50) return 'Nice effort, ' + name + '! Let us keep practising together.' + w;
  return name + ', let us spend a bit more time on this together. You can do this!' + w;
}
let teacherData = { records: [], comments: {}, remote: true };
async function renderTeacher() {
  const stage = $('stage'); stage.innerHTML = '<div class="card">Loading...</div>';
  const { records, remote } = await resultsStore.load();
  let comments = {};
  try { const r = await fetch('/api/comment'); if (r.ok) comments = (await r.json()).comments || {}; } catch (e) {}
  teacherData = { records, comments, remote };
  if (view !== 'teacher') return;
  drawTeacher();
}
function drawTeacher() {
  const { records, comments, remote } = teacherData, stage = $('stage');
  const classes = [...new Set(records.map(r => r.className))].sort();
  const recs = teacherClassFilter ? records.filter(r => r.className === teacherClassFilter) : records;
  const pupils = {};
  recs.forEach(r => { const k = r.name + '__' + r.className; (pupils[k] = pupils[k] || []).push(r); });
  const nPupils = Object.keys(pupils).length;
  const avg = recs.length ? Math.round(recs.reduce((a, r) => a + (r.percentage || 0), 0) / recs.length) : 0;
  const unitCount = {}; recs.forEach(r => { const p = parseSlug(r.game); if (p) unitCount[p.unit] = (unitCount[p.unit] || 0) + 1; });
  const topUnit = Object.entries(unitCount).sort((a, b) => b[1] - a[1])[0];
  const summary = [['Pupils played', nPupils], ['Rounds completed', recs.length], ['Class average', avg + '%'], ['Most played', topUnit ? (topUnit[0] === 'mix' ? 'Mixed' : 'Unit ' + topUnit[0].slice(1)) : '-']]
    .map(([l, v]) => '<div class="sumcard"><span>' + l + '</span><b>' + v + '</b></div>').join('');
  const prow = Object.entries(pupils).sort((a, b) => a[0].localeCompare(b[0])).map(([k, rs]) => {
    const t = dskpTPs(rs), spk = rs.filter(r => (parseSlug(r.game) || {}).skill === 'speak').length;
    const wrong = [...new Set(rs.flatMap(r => r.mistakes || []))];
    const a = Math.round(rs.reduce((x, r) => x + (r.percentage || 0), 0) / rs.length);
    const cm = comments[k] != null ? comments[k] : '';
    const cell = d => '<td title="' + esc(t[d] ? tpDesc(d, t[d]) : '') + '">' + tpBadge(t[d], t.pcts[d]) + '</td>';
    return '<tr><td>' + esc(rs[0].name) + '</td><td>' + esc(rs[0].className) + '</td>' + cell('Listening') + '<td>' + (spk ? spk + ' round' + (spk > 1 ? 's' : '') : '-') + '</td>' + cell('Reading') + cell('Writing') +
      '<td title="' + esc('Average of Listening, Reading and Writing') + '">' + tpBadge(t.overall) + '</td>' +
      '<td style="white-space:normal"><textarea class="cm" id="cm-' + esc(k) + '" placeholder="Comment">' + esc(cm) + '</textarea><br><button class="btn btn-sm" data-act="suggest" data-k="' + esc(k) + '" data-a="' + a + '">Suggest</button> <button class="btn btn-sm btn-blue" data-act="savecm" data-k="' + esc(k) + '">Save</button></td></tr>';
  }).join('');
  // DSKP standards that need practice: per unit+skill, pupils whose best score is below TP3 (under 45%)
  const gapMap = {};
  Object.values(pupils).forEach(rs => {
    const best = {};
    rs.forEach(r => { const p = parseSlug(r.game); if (!p || p.skill === 'speak') return; const k = p.unit + '|' + p.skill; best[k] = Math.max(best[k] || 0, r.percentage || 0); });
    Object.entries(best).forEach(([k, v]) => { gapMap[k] = gapMap[k] || { n: 0, low: 0 }; gapMap[k].n++; if (pct2tp(v) <= 2) gapMap[k].low++; });
  });
  const gaps = Object.entries(gapMap).filter(([, v]) => v.low > 0).sort((a, b) => b[1].low - a[1].low).slice(0, 6).map(([k, v]) => {
    const [u, s] = k.split('|'), sk = SKILL[s];
    return '<div class="gap-item">' + (u === 'mix' ? 'Mixed units' : 'Unit ' + u.slice(1) + ' ' + esc(UNITS[+u.slice(1)].name)) + ' &middot; ' + sk.label + ': ' + v.low + ' of ' + v.n + ' pupils at TP2 or below<br><span class="note">DSKP ' + sk.std.map(c => c + ' ' + esc(C.stdTitles[c] || '')).join('; ') + '</span></div>';
  }).join('') || '<span class="note">No gaps yet.</span>';
  const log = recs.slice().sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 120).map(r => {
    const p = parseSlug(r.game) || {}, sk = SKILL[p.skill], tp = sk && sk.id !== 'speak' ? pct2tp(r.percentage || 0) : null;
    return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.className) + '</td><td>' + (p.unit === 'mix' ? 'Mixed' : p.unit ? 'Unit ' + p.unit.slice(1) : esc(r.game)) + '</td><td>' + (sk ? sk.label : '') + '</td><td>' + (p.level || '') + '</td><td>' + r.score + '/' + r.total + '</td><td>' + r.percentage + '%</td><td title="' + esc(tp ? tpDesc(sk.dskp, tp) : '') + '">' + (tp ? tpBadge(tp) : '-') + '</td><td>' + (r.timeSeconds != null ? formatTime(r.timeSeconds) : '-') + '</td><td>' + (r.timestamp ? new Date(r.timestamp).toLocaleString() : '') + '</td></tr>';
  }).join('');
  const guide = ['Listening', 'Speaking', 'Reading', 'Writing'].map(d => '<details><summary>' + d + ' (DSKP Performance Standards)</summary><ul>' + [1, 2, 3, 4, 5, 6].map(n => '<li><b>TP' + n + '</b> (' + esc(C.tpNotes[n]) + '): ' + esc(tpDesc(d, n)) + '</li>').join('') + '</ul></details>').join('');
  stage.innerHTML = '<div class="teacher-header"><h2>Teacher View</h2><div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<select id="clsSel" class="form-input" style="min-height:44px;width:auto;font-size:16px"><option value="">All classes</option>' + classes.map(c => '<option' + (c === teacherClassFilter ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
    '<button class="btn btn-sm" data-act="csv">Download CSV</button><button class="btn btn-sm btn-danger" data-act="clearall">Clear All Results</button><button class="btn btn-sm" data-act="gohome">Back to Games</button></div></div>' +
    (remote ? '' : '<div class="gap-item">This view needs the Vercel storage backend connected. Showing results saved on this device only.</div>') +
    '<div class="teacher-summary">' + summary + '</div>' +
    '<h3 class="sec">TP by pupil (best attempt)</h3><div class="tbl-wrap"><table><thead><tr><th>Pupil</th><th>Class</th><th>Listening</th><th>Speaking</th><th>Reading</th><th>Writing</th><th>Overall TP</th><th>Comment</th></tr></thead><tbody>' + (prow || '<tr><td colspan="8">No results yet.</td></tr>') + '</tbody></table></div>' +
    '<p class="note">TP is a guide worked out from game scores (0-29% TP1, 30-44% TP2, 45-59% TP3, 60-74% TP4, 75-89% TP5, 90-100% TP6). Speaking is checked by you: the game only shows how many rounds were done. Hover a TP to see the DSKP descriptor.</p>' +
    '<h3 class="sec">Needs more practice</h3>' + gaps +
    '<h3 class="sec">Activity log</h3><div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Class</th><th>Unit</th><th>Skill</th><th>Star</th><th>Score</th><th>%</th><th>TP</th><th>Time</th><th>When</th></tr></thead><tbody>' + (log || '<tr><td colspan="10">No results yet.</td></tr>') + '</tbody></table></div>' +
    '<h3 class="sec">TP guide</h3><div class="tpguide">' + guide + '</div>';
}
function downloadCsv() {
  const recs = teacherClassFilter ? teacherData.records.filter(r => r.className === teacherClassFilter) : teacherData.records;
  const by = {}; recs.forEach(r => { const p = parseSlug(r.game); if (!p || p.skill === 'speak') return; const k = r.name + '__' + r.className + '__' + SKILL[p.skill].dskp; (by[k] = by[k] || []).push(r); });
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['Name', 'Class', 'Unit', 'Skill', 'Star', 'Score', 'Total', 'Percentage', 'TP', 'TP Descriptor', 'Cumulative TP (Best Attempt) for DSKP skill', 'Cumulative TP Descriptor', 'Time (s)', 'Mistakes', 'Timestamp', 'Teacher Comment'];
  const lines = [head.map(q).join(',')];
  recs.forEach(r => {
    const p = parseSlug(r.game) || {}, sk = SKILL[p.skill]; const tp = sk && sk.id !== 'speak' ? pct2tp(r.percentage || 0) : '';
    let ctp = '', cd = '';
    if (sk && sk.id !== 'speak') { const arr = by[r.name + '__' + r.className + '__' + sk.dskp]; if (arr) { ctp = pct2tp(bestPct(arr)); cd = tpDesc(sk.dskp, ctp); } }
    lines.push([r.name, r.className, p.unit || r.game, sk ? sk.label : '', p.level || '', r.score, r.total, r.percentage, tp ? 'TP' + tp : '', tp ? tpDesc(sk.dskp, tp) : '', ctp ? 'TP' + ctp : '', cd, r.timeSeconds, (r.mistakes || []).join('; '), r.timestamp, teacherData.comments[r.name + '__' + r.className] || ''].map(q).join(','));
  });
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'year1-english-results.csv'; document.body.appendChild(a); a.click(); a.remove();
}
function askPin() {
  if (teacherPin) return true;
  const p = window.prompt('Teacher PIN:');
  if (p === TEACHER_PIN) { teacherPin = p; return true; }
  if (p !== null) showToast('Wrong PIN', true);
  return false;
}

/* ---------- actions ---------- */
const acts = {
  unit(d) {
    if (d.u === 'all') sel.units = sel.units.length === 5 ? [0] : [0, 1, 2, 3, 4];
    else { const u = +d.u; const had = sel.units.length === 5 ? [] : sel.units; const s = had.includes(u) ? had.filter(x => x !== u) : [...had, u]; sel.units = s.length ? s : [u]; }
    saveSession(); render();
  },
  skill(d) { sel.skill = d.s; saveSession(); render(); },
  level(d) { sel.level = +d.l; saveSession(); render(); },
  start() { startGame(); },
  quit() { if (window.confirm('Stop this game?')) { G = null; view = 'home'; saveSession(); render(); } },
  gohome() { G = null; view = 'home'; saveSession(); render(); },
  again() { startGame(); },
  mine() { view = 'student'; render(); },
  play(d) { say('en', d.id); },
  pick(d) {
    const q = G.qs[G.idx], st = G.st; if (st.solved) return;
    const ok = d.id === (q.ans || q.id);
    if (ok) { st.solved = true; if (!st.tried) G.res[G.idx] = 1; beep(true); }
    else { st.tried = true; st.wrongs.push(d.id); G.res[G.idx] = 0; addMistake(qLabel(q)); beep(false); }
    saveSession(); render();
    if (ok) { if (q.k === 'tap' || q.k === 'w2p' || q.k === 'p2w' || q.k === 's2p' || q.k === 'letter') say('en', q.sid || q.id); }
  },
  next() {
    const st = G.st; if (!(st.solved || st.said)) return;
    if (st.said && G.res[G.idx] == null) G.res[G.idx] = 1;
    G.idx++; G.st = newSt();
    if (G.idx >= ROUND) { finishGame(); return; }
    saveSession(); render(); autoplay();
  },
  tile(d) {
    const q = G.qs[G.idx], st = G.st; if (st.solved || st.flash) return;
    const i = +d.i; if (st.placed.includes(i)) return;
    st.shakeTile = -1;
    if (q.k === 'spell') {
      const word = itemById[q.id].en, ch = q.tiles[i];
      if (G.level === 1 && ch !== word[st.placed.length]) { st.tried = true; G.res[G.idx] = 0; addMistake(word); st.shakeTile = i; beep(false); render(); return; }
      st.placed.push(i);
      if (st.placed.length === word.length) {
        const typed = st.placed.map(j => q.tiles[j]).join('');
        if (typed === word) { st.solved = true; if (!st.tried) G.res[G.idx] = 1; beep(true); saveSession(); render(); say('en', q.id); return; }
        st.tried = true; G.res[G.idx] = 0; addMistake(word); st.flash = true; beep(false); render();
        setTimeout(() => { if (G && G.st === st) { st.placed = []; st.flash = false; render(); } }, 900); return;
      }
      render(); return;
    }
    if (q.k === 'order') {
      st.placed.push(i);
      if (st.placed.length === q.n) {
        const s = sentById[q.sid], typed = st.placed.map(j => q.tiles[j]).join(' ');
        if (typed === s.en) { st.solved = true; if (!st.tried) G.res[G.idx] = 1; beep(true); saveSession(); render(); say('en', q.sid); return; }
        st.tried = true; G.res[G.idx] = 0; addMistake(s.en); st.flash = true; beep(false); render();
        setTimeout(() => { if (G && G.st === st) { st.placed = []; st.flash = false; render(); } }, 900); return;
      }
      render();
    }
  },
  untile(d) { const st = G.st; if (st.solved || st.flash) return; st.placed.splice(+d.k, 1); render(); },
  clear() { const st = G.st; if (st.solved || st.flash) return; st.placed = []; render(); },
  mean(d) { G.st.lang = d.l; const q = G.qs[G.idx]; say(d.l, q.id); render(); },
  said() { G.st.said = !G.st.said; saveSession(); render(); },
  flip(d) {
    const m = G.mem; if (m.lock) return; const i = +d.i, c = m.cards[i]; if (c.done || c.up) return;
    c.up = true; m.up.push(i);
    if (c.t === 'pic') say('en', c.pid);
    if (m.up.length === 2) {
      const a = m.cards[m.up[0]], b = m.cards[m.up[1]];
      if (a.pid === b.pid) {
        a.done = b.done = true; m.up = []; beep(true);
        if (m.cards.every(x => x.done)) { render(); setTimeout(finishGame, 700); return; }
      } else {
        [a.pid, b.pid].forEach(p => { if (!m.mism.includes(p)) { m.mism.push(p); addMistake(label(itemById[p])); } });
        m.lock = true; beep(false); render();
        setTimeout(() => { if (G && G.mem === m) { a.up = b.up = false; m.up = []; m.lock = false; render(); } }, 1000); return;
      }
    }
    saveSession(); render();
  },
  suggest(d) {
    const rs = teacherData.records.filter(r => r.name + '__' + r.className === d.k);
    const words = [...new Set(rs.flatMap(r => r.mistakes || []))];
    const ta = $('cm-' + d.k); if (ta) ta.value = suggestComment(rs[0].name, +d.a, words);
  },
  async savecm(d) {
    if (!askPin()) return;
    const ta = $('cm-' + d.k); const rs = teacherData.records.find(r => r.name + '__' + r.className === d.k);
    try {
      const r = await fetch('/api/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: rs.name, className: rs.className, comment: ta.value, pin: teacherPin }) });
      if (r.ok) { teacherData.comments[d.k] = ta.value; showToast('Comment saved'); } else { if (r.status === 401) teacherPin = null; showToast('Could not save comment', true); }
    } catch (e) { showToast('Could not save comment', true); }
  },
  csv() { downloadCsv(); },
  async clearall() {
    if (!askPin()) return;
    if (!window.confirm('Delete ALL results for ALL classes? This cannot be undone.')) return;
    try {
      const r = await fetch('/api/clear-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: teacherPin }) });
      if (r.ok) { try { localStorage.removeItem(LOCAL_KEY); } catch (e) {} showToast('All results cleared'); renderTeacher(); }
      else { if (r.status === 401) teacherPin = null; showToast('Could not clear results', true); }
    } catch (e) { showToast('Could not clear results', true); }
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = acts[el.dataset.act]; if (fn) fn(el.dataset);
});
document.addEventListener('change', e => {
  if (e.target.id === 'lbSel') { window._lbSlug = e.target.value; renderStudent(); }
  if (e.target.id === 'clsSel') { teacherClassFilter = e.target.value; drawTeacher(); }
});

/* ---------- login / logout / resume ---------- */
function enterApp() {
  $('loginPage').classList.add('hidden'); $('mainApp').classList.remove('hidden');
  $('welcomeName').textContent = currentStudent.name; $('welcomeClass').textContent = '(' + currentStudent.className + ')';
}
$('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const name = $('studentName').value.trim(), className = $('studentClass').value.trim();
  if (!name || !className) { showToast('Please fill in all fields', true); return; }
  currentStudent = { name, className }; sessionResults = []; G = null; view = 'home';
  saveSession(); showToast('Welcome, ' + name + '!'); enterApp(); render();
});
function logout() {
  currentStudent = null; sessionResults = []; teacherPin = null; G = null; view = 'home';
  clearSession();
  $('loginForm').reset(); $('loginButton').disabled = false; $('loginButton').textContent = "Let's go!";
  $('mainApp').classList.add('hidden'); $('loginPage').classList.remove('hidden'); $('resumeBanner').classList.add('hidden');
  showToast('Logged out');
}
window.logout = logout;
function checkForResumableSession() {
  const s = loadSession();
  if (s && s.student && s.student.name) { $('resumeName').textContent = s.student.name + ' (' + s.student.className + ')'; $('resumeBanner').classList.remove('hidden'); }
}
$('startFreshBtn').addEventListener('click', () => { clearSession(); $('resumeBanner').classList.add('hidden'); });
$('resumeBtn').addEventListener('click', () => {
  const s = loadSession(); if (!s || !s.student) return;
  currentStudent = s.student; sessionResults = s.sessionResults || []; sel = s.sel || sel;
  G = s.G || null;
  if (G && G.mem) { G.mem.lock = false; G.mem.up = []; G.mem.cards.forEach(c => { if (!c.done) c.up = false; }); }
  view = (s.view === 'game' && G && !G.done) ? 'game' : (s.view === 'result' && G && G.done ? 'result' : 'home');
  enterApp(); render();
});
$('homeBtn').addEventListener('click', () => { view = G && !G.done ? 'game' : 'home'; if (G && G.done) G = null; render(); });
$('studentViewBtn').addEventListener('click', () => { view = 'student'; render(); });
$('teacherViewBtn').addEventListener('click', () => { if (!askPin()) return; view = 'teacher'; render(); });

checkForResumableSession();
if (location.search.indexOf('debug') >= 0) window.__yp = { getG: () => G, itemById, sentById };
})();
