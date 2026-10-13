/**
 * Shared Vercel KV client. Reads the standard KV_REST_API_* variables, and also the prefixed
 * names Vercel created when this project's database was connected with the prefix "year1SupermindRevision".
 * (A file starting with "_" is not a public endpoint.)
 */
const { createClient } = require('@vercel/kv');

module.exports = createClient({
  url: process.env.KV_REST_API_URL || process.env.year1SupermindRevision_KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.year1SupermindRevision_KV_REST_API_TOKEN
});
