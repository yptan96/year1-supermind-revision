/**
 * Wipes this app's (Year 1) saved game results only (its own key, see _kv.js) — used by Teacher View's "Clear All Results" button.
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
    // Own list (see _kv.js): other games' results live under different keys and are never touched.
    await kv.del(kv.RESULTS_KEY);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('KV clear failed:', err);
    res.status(500).json({ ok: false, error: 'Storage not connected yet' });
  }
};
