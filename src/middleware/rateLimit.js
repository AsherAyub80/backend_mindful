// src/middleware/rateLimit.js
const redis = require('../config/redis');

/**
 * Simple Redis-based sliding window rate limiter
 * Works with Upstash free tier (10,000 commands/day)
 */
function rateLimit({ windowMs = 60000, max = 100, keyPrefix = 'rl' } = {}) {
  return async (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const key = `${keyPrefix}:${userId}`;
    const window = Math.floor(windowMs / 1000);

    try {
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, window);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));

      if (current > max) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: window,
        });
      }
    } catch {
      // If Redis fails, allow request (fail open)
    }
    next();
  };
}

// Presets
const generalLimit = rateLimit({ windowMs: 60000, max: 100 });
const authLimit = rateLimit({ windowMs: 60000, max: 10, keyPrefix: 'rl:auth' });
const aiLimit = rateLimit({ windowMs: 3600000, max: 30, keyPrefix: 'rl:ai' }); // 30/hour

module.exports = { rateLimit, generalLimit, authLimit, aiLimit };
