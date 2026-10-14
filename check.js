/* Answer checker for typed / handwriting-keyboard answers.
   checkAnswer(expected, actual) -> { ok, issues:[{type, say, ...}], my:[{text, bad}], teacher:[{text}] }
   Checks, in this order: capital letter at the start, full stop (or ? !) at the end, spaces between words,
   missing / extra / wrong words and spelling, capital letters inside the sentence (I, names), small letters that should not be capital. */
(function (root) {
  'use strict';
  const END = /[.?!]$/;
  const stripEnd = w => w.replace(/[.?!,]+$/, '');
  const lower = s => s.toLowerCase();

  function editDistance(a, b) {
    const m = a.length, n = b.length, d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }

  // align expected words (E) with the pupil's words (A): returns pairs [ei|null, ai|null]
  function align(E, A) {
    const m = E.length, n = A.length, cost = [];
    const sub = (e, a) => {
      const x = lower(stripEnd(e)), y = lower(stripEnd(a));
      if (x === y) return 0;
      const ed = editDistance(x, y);
      return ed <= Math.max(2, Math.floor(x.length / 2)) ? 1 + ed * 0.1 : 3; // near miss = spelling, otherwise a different word
    };
    for (let i = 0; i <= m; i++) { cost[i] = []; }
    cost[0][0] = 0;
    for (let i = 1; i <= m; i++) cost[i][0] = i * 2;
    for (let j = 1; j <= n; j++) cost[0][j] = j * 2;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      cost[i][j] = Math.min(cost[i - 1][j] + 2, cost[i][j - 1] + 2, cost[i - 1][j - 1] + sub(E[i - 1], A[j - 1]));
    const out = []; let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && Math.abs(cost[i][j] - (cost[i - 1][j - 1] + sub(E[i - 1], A[j - 1]))) < 1e-9) { out.push([i - 1, j - 1]); i--; j--; }
      else if (i > 0 && Math.abs(cost[i][j] - (cost[i - 1][j] + 2)) < 1e-9) { out.push([i - 1, null]); i--; }
      else { out.push([null, j - 1]); j--; }
    }
    return out.reverse();
  }

  function checkAnswer(expected, actual) {
    const exp = String(expected).trim();
    const raw = String(actual == null ? '' : actual);
    const act = raw.trim();
    const issues = [];
    const teacher = exp.split(/\s+/).map(t => ({ text: t }));
    if (!act) return { ok: false, empty: true, issues: [{ type: 'empty', say: 'Write your answer in the box.' }], my: [], teacher };

    // 1. capital letter at the start
    const firstExp = exp.charAt(0), firstAct = act.charAt(0);
    if (/[A-Z]/.test(firstExp) && /[a-z]/.test(firstAct)) issues.push({ type: 'capital', say: 'Start with a BIG letter.', fix: firstAct + ' → ' + firstAct.toUpperCase() });

    // 2. full stop / question mark / exclamation at the end
    const endExp = (exp.match(END) || [''])[0], endAct = (act.match(END) || [''])[0];
    if (endExp && !endAct) {
      const nm = endExp === '.' ? 'a full stop ( . )' : endExp === '?' ? 'a question mark ( ? )' : 'an exclamation mark ( ! )';
      issues.push({ type: 'punct', say: 'Put ' + nm + ' at the end.' });
    } else if (endExp && endAct && endExp !== endAct) {
      issues.push({ type: 'punct', say: 'Check the mark at the end. It should be ' + endExp + ' not ' + endAct });
    } else if (!endExp && endAct) {
      issues.push({ type: 'punct', say: 'You do not need ' + endAct + ' at the end.' });
    }

    // 3. spaces between words
    const E = exp.split(/\s+/), A = act.split(/\s+/);
    const squash = s => lower(s).replace(/[\s.?!,]/g, '');
    if (/\s{2,}/.test(act) || (squash(act) === squash(exp) && A.length !== E.length)) {
      issues.push({ type: 'space', say: 'Leave one space between words.' });
    }

    // 4 + 5. words, spelling, capitals inside the sentence
    const spaceOnly = issues.some(i => i.type === 'space') && squash(act) === squash(exp);
    const pairs = align(E, A), my = A.map(t => ({ text: t, bad: false }));
    if (spaceOnly) { // only the spaces are wrong: do not also report every word
      my.forEach(w => { w.bad = true; });
      const ok0 = issues.length === 0;
      return { ok: ok0, issues, my, teacher };
    }
    const sameWords = pairs.filter(([ei, ai]) => ei != null && ai != null && lower(stripEnd(E[ei])) === lower(stripEnd(A[ai]))).length;
    const oneWordSlip = E.length === 1 && A.length === 1 && editDistance(lower(stripEnd(E[0])), lower(stripEnd(A[0]))) <= Math.max(2, Math.floor(E[0].length / 2));
    if (sameWords / E.length < 0.4 && !oneWordSlip) { // mostly different: one clear message instead of a long list
      issues.length = 0;
      issues.push({ type: 'different', say: 'Your answer is different. Look at the teacher’s answer and try again.' });
      my.forEach(w => { w.bad = true; });
      return { ok: false, issues, my, teacher };
    }
    pairs.forEach(([ei, ai]) => {
      if (ei != null && ai == null) { issues.push({ type: 'missing', say: 'A word is missing: ' + stripEnd(E[ei]), word: stripEnd(E[ei]) }); return; }
      if (ei == null && ai != null) { issues.push({ type: 'extra', say: 'You wrote an extra word: ' + stripEnd(A[ai]), word: stripEnd(A[ai]) }); my[ai].bad = true; return; }
      const e = stripEnd(E[ei]), a = stripEnd(A[ai]);
      if (lower(e) !== lower(a)) {
        const ed = editDistance(lower(e), lower(a));
        if (ed <= Math.max(2, Math.floor(e.length / 2))) issues.push({ type: 'spelling', say: 'Check the spelling: ' + a + ' → ' + e, word: a, right: e });
        else issues.push({ type: 'word', say: 'Check this word: ' + a + ' → ' + e, word: a, right: e });
        my[ai].bad = true; return;
      }
      if (e !== a && ei > 0 && /[A-Z]/.test(e) && !(ei === 0)) { issues.push({ type: 'capital', say: 'Use a BIG letter in: ' + e, word: e }); my[ai].bad = true; }
      else if (e !== a && ei > 0 && /[A-Z]/.test(a) && !/[A-Z]/.test(e)) { issues.push({ type: 'small', say: 'Use a small letter here: ' + a + ' → ' + e, word: a }); my[ai].bad = true; }
    });
    // mark the first word bad if the start capital is missing
    if (issues.some(i => i.type === 'capital' && !i.word) && my[0]) my[0].bad = true;
    // mark the last word bad if end punctuation is wrong
    if (issues.some(i => i.type === 'punct') && my.length) my[my.length - 1].bad = true;

    const ok = issues.length === 0;
    return { ok, issues, my, teacher };
  }

  /* ---------------------------------------------------------------------------------------------------------
     Challenge level: the pupil writes their OWN sentence about a picture, so there is no single right answer.
     checkFrame(frame, text, ctx) checks the writing rules (big letter, full stop, spaces, I) and the task:
       frame = { kind:'pos'|'have'|'havent'|'its', a:{noun,syn,pal}, b:{...}, x:{...}, prep:'on' }
       ctx   = { dict:Set(lower-case words the app knows) }
     Extra details are welcome: colour words are checked against the picture's colours (pal), describing words
     are accepted, and short places like "in the living room" are accepted. Anything else is passed to the teacher.
     --------------------------------------------------------------------------------------------------------- */
  const COLOURS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'grey', 'gray'];
  const DESCR = ['big', 'small', 'little', 'tiny', 'huge', 'tall', 'short', 'long', 'old', 'new', 'beautiful', 'ugly', 'cute', 'happy', 'sad', 'fat', 'thin', 'soft', 'hard', 'nice', 'lovely', 'funny', 'pretty', 'shiny', 'clean', 'dirty', 'young', 'sleepy', 'hungry', 'baby', 'smart', 'great'];
  const PLACES = ['living room', 'bedroom', 'kitchen', 'garden', 'house', 'home', 'classroom', 'school', 'park', 'room', 'bathroom', 'yard', 'floor', 'table', 'shelf', 'bed', 'box', 'basket', 'tree', 'zoo', 'farm', 'pond'];
  const PREPS = ['in', 'on', 'at', 'under', 'near', 'beside', 'behind', 'inside', 'outside', 'by'];
  const DET = ['the', 'a', 'an'];
  const KNOWN = new Set([].concat(COLOURS, DESCR, PREPS, DET, ['is', 'are', 'it', 'its', "it's", 'i', "i've", 'have', 'has', 'got', 'not', "haven't", 'and', 'with', 'next', 'to', 'no', 'my', 'this', 'that', 'there'], PLACES.join(' ').split(' ')));
  const wordsOf = t => String(t).trim().replace(/’/g, "'").split(/\s+/).filter(Boolean);
  const bare = w => w.toLowerCase().replace(/[.?!,]+$/, '');
  const vowelSound = w => { w = w.toLowerCase(); if (/^(hour|honest|heir)/.test(w)) return true; if (/^(uni|use|eu|one|once)/.test(w)) return false; return /^[aeiou]/.test(w); };

  function checkFrame(frame, text, ctx) {
    ctx = ctx || {};
    const dict = ctx.dict || new Set();
    const raw = String(text || '').replace(/’/g, "'");
    const act = raw.trim();
    const O = wordsOf(act), L = O.map(bare);
    const issues = [], extras = [], review = [], bad = new Set();
    const res = () => ({ ok: issues.length === 0, issues, extras, review, my: O.map((t, i) => ({ text: t, bad: bad.has(i) })), reviewNeeded: review.length > 0 });
    if (!act) return { ok: false, empty: true, issues: [{ type: 'empty', say: 'Write your answer in the box.' }], extras, review, my: [] };

    // writing rules
    if (/[a-z]/.test(act.charAt(0))) { issues.push({ type: 'capital', say: 'Start with a BIG letter.' }); bad.add(0); }
    if (!/[.!?]$/.test(act)) { issues.push({ type: 'punct', say: 'Put a full stop ( . ) at the end.' }); bad.add(O.length - 1); }
    else if (/[?]$/.test(act)) { issues.push({ type: 'punct', say: 'This sentence tells us something. End with a full stop ( . ).' }); }
    if (/\s{2,}/.test(raw.trim())) issues.push({ type: 'space', say: 'Leave one space between words.' });
    O.forEach((w, i) => { if (/^i('m|'ve|'ll|'d)?$/.test(w)) { issues.push({ type: 'capital', say: 'Use a BIG letter for I.' }); bad.add(i); } });

    let p = 0;
    const near = (a, b) => { if (!a || !b) return false; return editDistance(a, b) <= Math.max(1, Math.floor(b.length / 3)); };
    const matchAt = (i, noun) => noun.toLowerCase().split(' ').every((t, k) => L[i + k] === t);
    const nounForms = n => [n.noun].concat(n.syn || []);

    function adjective(i, owner) {
      const t = L[i];
      if (COLOURS.indexOf(t) >= 0) {
        const c = t === 'gray' ? 'grey' : t;
        if (!owner || !owner.pal || !owner.pal.length) { extras.push({ text: t, verified: false }); return true; }
        if (owner.pal.indexOf(c) >= 0) { extras.push({ text: t, verified: true }); return true; }
        issues.push({ type: 'colour', say: 'Check the colour: the ' + owner.noun + ' is ' + (owner.pal.length > 1 ? owner.pal.slice(0, -1).join(', ') + ' and ' + owner.pal[owner.pal.length - 1] : owner.pal[0]) + '.' }); bad.add(i); return true;
      }
      if (DESCR.indexOf(t) >= 0) { extras.push({ text: t, verified: false }); return true; }
      if (dict.has(t) || KNOWN.has(t)) { extras.push({ text: t, verified: false }); return true; }     // e.g. cheese in "cheese sandwich"
      const cand = COLOURS.concat(DESCR).find(x => near(t, x) && Math.abs(x.length - t.length) <= 2);
      if (cand) { issues.push({ type: 'spelling', say: 'Check the spelling: ' + bare(O[i]) + ' → ' + cand }); bad.add(i); return true; }
      review.push(bare(O[i])); bad.add(i); return false;
    }
    // [a / an / the] [describing words] noun
    function nounPhrase(owner, opts) {
      opts = opts || {};
      const allowed = opts.det || DET;
      let det = null;
      if (DET.indexOf(L[p]) >= 0) {
        det = L[p];
        if (allowed.indexOf(det) < 0) { issues.push({ type: 'det', say: 'Use ' + allowed.join(' or ') + ' here.' }); bad.add(p); }
        p++;
      } else { issues.push({ type: 'missing', say: 'A word is missing: ' + (allowed.indexOf('the') >= 0 ? 'The' : 'a') }); }
      const detIdx = p - 1;
      let guard = 0, found = false;
      while (p < L.length && guard++ < 4) {
        const forms = nounForms(owner), hit = forms.find(n => matchAt(p, n));
        if (hit) { p += hit.split(' ').length; found = true; break; }
        const slip = forms.find(n => n.indexOf(' ') < 0 && near(L[p], n));
        if (slip) { issues.push({ type: 'spelling', say: 'Check the spelling: ' + bare(O[p]) + ' → ' + slip }); bad.add(p); p++; found = true; break; }
        if (L[p] === 'is' || PREPS.indexOf(L[p]) >= 0 || L[p] === 'got') break;       // ran past the noun
        adjective(p, owner); p++;
      }
      if (!found) issues.push({ type: 'missing', say: 'Look at the picture. Write about the ' + owner.noun + '.' });
      if (det === 'a' || det === 'an') {
        const next = L[detIdx + 1];
        if (next) { const v = vowelSound(next); if (det === 'a' && v) { issues.push({ type: 'aan', say: 'Use an before ' + next + ': an ' + next }); bad.add(detIdx); } if (det === 'an' && !v) { issues.push({ type: 'aan', say: 'Use a before ' + next + ': a ' + next }); bad.add(detIdx); } }
      }
      return found;
    }
    function places() { // extra detail: "in the living room"
      while (p < L.length) {
        const start = p; let ok = false;
        if (L[p] === 'next' && L[p + 1] === 'to') p += 2; else if (PREPS.indexOf(L[p]) >= 0) p++; else break;
        if (DET.indexOf(L[p]) >= 0) p++;
        let adjN = 0; while (p < L.length && (COLOURS.indexOf(L[p]) >= 0 || DESCR.indexOf(L[p]) >= 0) && adjN++ < 2) p++;
        const place = PLACES.find(pl => matchAt(p, pl));
        if (place) { p += place.split(' ').length; ok = true; extras.push({ text: O.slice(start, p).join(' ').replace(/[.?!]+$/, ''), verified: false, place: true }); }
        if (!ok) { p = start; break; }
      }
    }
    function rest() { if (p < L.length) { const r = O.slice(p).join(' ').replace(/[.?!]+$/, ''); if (r) { review.push(r); for (let i = p; i < O.length; i++) bad.add(i); } p = L.length; } }

    if (frame.kind === 'pos') {
      nounPhrase(frame.a, { det: DET });
      if (L[p] === 'is') p++; else if (!(L[p - 1] && /'s$/.test(L[p - 1]))) issues.push({ type: 'missing', say: 'A word is missing: is' });
      // richer sentences: "is sleeping on", "is happy on"
      let skip = 0; while (p < L.length && skip++ < 2 && PREPS.indexOf(L[p]) < 0 && (/ing$/.test(L[p]) || DESCR.indexOf(L[p]) >= 0)) { extras.push({ text: L[p], verified: false }); p++; }
      if (L[p] === frame.prep) p++;
      else if (['in', 'on', 'under'].indexOf(L[p]) >= 0) { issues.push({ type: 'prep', say: 'Look at the picture. The ' + frame.a.noun + ' is ' + frame.prep.toUpperCase() + ' the ' + frame.b.noun + '.' }); bad.add(p); p++; }
      else issues.push({ type: 'missing', say: 'A word is missing: ' + frame.prep });
      nounPhrase(frame.b, { det: DET });
      places(); rest();
    } else if (frame.kind === 'have' || frame.kind === 'havent') {
      const neg = frame.kind === 'havent';
      const wrongWay = neg ? "Look at the picture. You HAVEN'T got this." : 'Look at the picture. You HAVE got this.';
      if (L[0] === "i've") { p = 1; if (neg) { issues.push({ type: 'wrong', say: wrongWay }); bad.add(0); } }
      else {
        if (L[p] === 'i') p++; else issues.push({ type: 'missing', say: 'Start with: I' });
        if (L[p] === "haven't") { p++; if (!neg) { issues.push({ type: 'wrong', say: wrongWay }); bad.add(p - 1); } }
        else if (L[p] === 'have' && L[p + 1] === 'not') { p += 2; if (!neg) { issues.push({ type: 'wrong', say: wrongWay }); bad.add(p - 1); } }
        else if (L[p] === 'have') { p++; if (neg) { issues.push({ type: 'wrong', say: wrongWay + " Write haven't." }); bad.add(p - 1); } }
        else issues.push({ type: 'missing', say: 'A word is missing: ' + (neg ? "haven't" : 'have') });
      }
      if (L[p] === 'got') p++; else issues.push({ type: 'missing', say: 'A word is missing: got' });
      nounPhrase(frame.x, { det: ['a', 'an'] });
      rest();
    } else if (frame.kind === 'its') {
      if (L[p] === "it's") p++; else if (L[p] === 'it' && L[p + 1] === 'is') p += 2; else issues.push({ type: 'missing', say: "Start with: It's" });
      nounPhrase(frame.x, { det: ['a', 'an'] });
      rest();
    }
    return res();
  }
  root.checkFrame = checkFrame;
  root.CHECK_WORDS = { COLOURS, DESCR, PLACES };

  root.checkAnswer = checkAnswer;
  if (typeof module !== 'undefined') module.exports = { checkAnswer, checkFrame };
})(typeof window !== 'undefined' ? window : globalThis);
