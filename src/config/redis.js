// src/config/redis.js
const Redis = require('ioredis');
const config = require('./index');

let redis;

if (config.redis.url) {
  redis = new Redis(config.redis.url, {
    tls: config.redis.url.startsWith('rediss://') ? {} : undefined,
    maxRetriesPerRequest: 3,         // Fail after 3 attempts instead of hanging
    connectTimeout: 5000,           // 5 second timeout
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redis.on('connect', () => console.log('✅ Redis connected (Upstash)'));
  redis.on('error', (err) => {
    console.warn('⚠️  Redis connection failed:', err.message);
    // Note: We don't crash here because the app can fall back to in-memory/ignore errors
  });
} else {
  // Fallback: in-memory cache for local dev without Redis
  console.warn('⚠️  No REDIS_URL — using in-memory cache (dev only)');
  const store = new Map();
  redis = {
    get: async (k) => store.get(k) ?? null,
    set: async (k, v, ex, ttl) => { store.set(k, v); if (ttl) setTimeout(() => store.delete(k), ttl * 1000); return 'OK'; },
    setex: async (k, ttl, v) => { store.set(k, v); setTimeout(() => store.delete(k), ttl * 1000); return 'OK'; },
    del: async (k) => { store.delete(k); return 1; },
    exists: async (k) => store.has(k) ? 1 : 0,
    incr: async (k) => { const v = (parseInt(store.get(k)) || 0) + 1; store.set(k, String(v)); return v; },
    expire: async () => 1,
    quit: async () => { },
  };
}

// Helper: get with JSON parse
redis.getJSON = async (key) => {
  const val = await redis.get(key);
  return val ? JSON.parse(val) : null;
};

// Helper: set with JSON stringify + TTL
redis.setJSON = async (key, value, ttlSeconds = 600) => {
  return redis.setex(key, ttlSeconds, JSON.stringify(value));
};

module.exports = redis;
