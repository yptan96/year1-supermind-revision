/**
 * Removes this app's (Year 1) saved game results only; other games' results in the shared list are kept — used by Teacher View's "Clear All Results" button.
 * Leaves teacher comments untouched (that's a separate Redis hash, "results" is only
 * the scores list).
 *
 * PIN-gated server-side the same way as comment.js's POST — the check lives here, in a
 * file never sent to the browser, not just in the index.html UI prompt.
 * Keep TEACHER_PIN in sync with index.html and api/comment.js if you change it.
 */

const kv = require('./_kv');

const TEACHER_PIN = '961123';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  if (body.pin !== TEACHER_PIN) {
    res.status(401).json({ ok: false, error: 'Incorrect PIN' });
    return;
  }

  try {
    // The database is shared with other games (Y5/Y6 UASA etc.), so only remove THIS app's records.
    // This app's slugs look like u0-listen-s1 or mix-write-s2; everything else is kept.
    const mine = /^(u\d|mix)-[a-z]+-s\d$/;
    const all = await kv.lrange('results', 0, -1);
    const keep = all.filter(r => !(r && mine.test(String(r.game))));
    await kv.del('results');
    if (keep.length) await kv.rpush('results', ...keep);
    res.status(200).json({ ok: true, removed: all.length - keep.length, kept: keep.length });
  } catch (err) {
    console.error('KV clear failed:', err);
    res.status(500).json({ ok: false, error: 'Storage not connected yet' });
  }
};
