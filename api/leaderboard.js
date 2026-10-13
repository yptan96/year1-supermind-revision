/**
 * Returns every saved game result as JSON, for the Leaderboard and Teacher View tabs.
 * See save.js for the storage setup steps (same Vercel KV database, no config needed
 * in this file — the env vars Vercel injects are enough).
 */

const kv = require('./_kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const records = await kv.lrange('results', 0, -1);
    res.status(200).json(records);
  } catch (err) {
    console.error('KV read failed:', err);
    // 503 signals "storage not connected yet" to the front end, as opposed to
    // a 200 with an empty list, which would mean "connected, just no scores yet".
    res.status(503).json({ ok: false, error: 'Storage not connected yet' });
  }
};
