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
    if (sameWords / E.length < 0.4) { // mostly different: one clear message instead of a long list
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

  root.checkAnswer = checkAnswer;
  if (typeof module !== 'undefined') module.exports = { checkAnswer };
})(typeof window !== 'undefined' ? window : globalThis);
