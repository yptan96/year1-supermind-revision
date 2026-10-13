/**
 * Teacher comments — one note per student, stored in a Redis hash separate from the
 * results list. Uses the same Vercel KV database as save.js/leaderboard.js, no extra setup.
 *
 * GET  /api/comment                              -> { ok, comments: { "name__class": "text", ... } }  (Teacher View, bulk)
 * GET  /api/comment?name=X&className=Y           -> { ok, comment: "text" }                            (Student View, single)
 * POST /api/comment  { name, className, comment, pin } -> { ok }                                       (Teacher View, save)
 *
 * The POST is PIN-gated server-side (unlike the Teacher View PIN prompt in index.html,
 * which is only a UI convenience — that PIN is visible to anyone who reads the page
 * source). This TEACHER_PIN lives in a file that's never sent to the browser, so it's
 * an actual authorization check: without it, anyone who found this URL could overwrite
 * a student's comment. Keep this in sync with TEACHER_PIN in index.html's <script> if
 * you change it — the index.html copy still gates whether the Teacher View UI opens at
 * all, this copy is what actually protects the write.
 */

const kv = require('./_kv');

const TEACHER_PIN = '961123';

function studentKey(name, className) {
  return `${String(name || '').trim()}__${String(className || '').trim()}`;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const { name, className } = req.query || {};
    try {
      if (name) {
        const comment = await kv.hget('comments', studentKey(name, className));
        res.status(200).json({ ok: true, comment: comment || '' });
      } else {
        const all = await kv.hgetall('comments');
        res.status(200).json({ ok: true, comments: all || {} });
      }
    } catch (err) {
      console.error('KV comment read failed:', err);
      res.status(503).json({ ok: false, error: 'Storage not connected yet' });
    }
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.pin !== TEACHER_PIN) {
      res.status(401).json({ ok: false, error: 'Incorrect PIN' });
      return;
    }
    if (!body.name) {
      res.status(400).json({ ok: false, error: 'Missing name' });
      return;
    }
    try {
      await kv.hset('comments', { [studentKey(body.name, body.className)]: String(body.comment || '').slice(0, 500) });
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('KV comment save failed:', err);
      res.status(500).json({ ok: false, error: 'Storage not connected yet' });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
