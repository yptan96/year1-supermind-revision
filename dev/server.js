// Local test server: serves the app and runs the REAL api/*.js handlers against an in-memory stand-in for @vercel/kv.
// Run:  node dev/server.js   then open http://localhost:3000   (not deployed to Vercel; for testing only)
const http = require('http'), fs = require('fs'), path = require('path'), Module = require('module');
const ROOT = path.join(__dirname, '..');
const lists = {}, hashes = {};
const kv = {
  rpush: async (k, ...vs) => { (lists[k] = lists[k] || []).push(...vs.map(v => JSON.parse(JSON.stringify(v)))); },
  lrange: async (k) => lists[k] || [],
  del: async (k) => { delete lists[k]; },
  hget: async (k, f) => (hashes[k] || {})[f],
  hset: async (k, o) => { hashes[k] = Object.assign(hashes[k] || {}, o); },
  hgetall: async (k) => hashes[k] || null,
};
const orig = Module._load;
Module._load = function (req, ...a) { return req === '@vercel/kv' ? { kv, createClient: () => kv } : orig.call(this, req, ...a); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json', '.css': 'text/css' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    const file = path.join(ROOT, 'api', u.pathname.slice(5) + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('no such api'); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try { req.body = body ? JSON.parse(body) : {}; } catch (e) { req.body = {}; }
      req.query = Object.fromEntries(u.searchParams);
      res.status = c => { res.statusCode = c; return res; };
      res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      try { await require(file)(req, res); } catch (e) { res.statusCode = 500; res.end(String(e)); }
    });
    return;
  }
  let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(3000, () => console.log('http://localhost:3000'));
