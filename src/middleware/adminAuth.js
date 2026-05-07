// src/middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');

async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, handle, role, status')
      .eq('id', decoded.userId)
      .single();

    if (error || !user)
      return res.status(401).json({ error: 'User not found' });

    if (user.role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAdmin };
