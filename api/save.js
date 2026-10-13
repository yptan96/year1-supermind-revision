/**
 * Saves one game result to Vercel KV (Redis). Called by the app's resultsStore.save()
 * whenever a pupil finishes the Spelling or Categories game.
 *
 * SETUP (see the matching leaderboard.js for the read side):
 * 1. Deploy this project to Vercel (import the GitHub repo, or `vercel` CLI).
 * 2. In the Vercel dashboard: your project > Storage tab > Create Database > pick a
 *    Redis option (e.g. the Upstash integration) > Connect it to this project.
 *    Vercel automatically adds the KV_REST_API_URL / KV_REST_API_TOKEN env vars —
 *    you don't need to copy/paste anything into the code.
 * 3. Redeploy once (Vercel > Deployments > ... > Redeploy) so the function picks up
 *    the new environment variables.
 * That's it — no URL to paste anywhere, unlike the Google Sheets version.
 */

const kv = require('./_kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};

  if (!body.name || !body.game) {
    res.status(400).json({ ok: false, error: 'Missing required fields' });
    return;
  }

  const record = {
    name: String(body.name).slice(0, 100),
    className: String(body.className || '').slice(0, 50),
    game: String(body.game).slice(0, 30),
    score: Number(body.score) || 0,
    total: Number(body.total) || 0,
    percentage: Number(body.percentage) || 0,
    timeSeconds: body.timeSeconds != null ? Number(body.timeSeconds) : null,
    mistakes: Array.isArray(body.mistakes) ? body.mistakes.slice(0, 20).map(String) : [],
    timestamp: new Date().toISOString()
  };

  try {
    await kv.rpush(kv.RESULTS_KEY, record);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('KV save failed:', err);
    res.status(500).json({ ok: false, error: 'Storage not connected yet' });
  }
};
