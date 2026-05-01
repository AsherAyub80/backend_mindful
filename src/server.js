// src/server.js
require('dotenv').config();
const app       = require('./app');
const config    = require('./config');
const redis     = require('./config/redis');
const scheduler = require('./services/scheduler');

const server = app.listen(config.port, () => {
  console.log(`
🌿 MindfulMeals API  —  Phase 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀  Server  :  http://localhost:${config.port}
🤖  AI      :  Groq Llama 3.3 70B   (FREE)
🐘  DB      :  Supabase PostgreSQL   (FREE 500 MB)
⚡  Cache   :  ${config.redis.url ? 'Upstash Redis (Active)' : 'Local Memory (Failover)'}
📦  Storage :  Supabase Storage      (FREE 1 GB)
🔔  Push    :  Firebase FCM          (FREE unlimited)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
  scheduler.start();
});

async function shutdown(signal) {
  console.log(`\n${signal} — shutting down`);
  scheduler.stop();
  try { await redis.quit(); } catch (_) {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (e) => { console.error('Uncaught:', e); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('Unhandled:', e); });

module.exports = server;
