// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');

/**
 * Verify JWT and attach user to req.user
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    // Fetch fresh user from Supabase
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, handle, avatar_url, streak_count')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Optional auth — attaches user if token present, but doesn't block
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    const { data: user } = await supabaseAdmin
      .from('users').select('id, email, name, handle').eq('id', decoded.userId).single();
    req.user = user;
  } catch {
    // silently ignore — optional
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
