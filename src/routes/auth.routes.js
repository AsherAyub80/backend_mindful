// src/routes/auth.routes.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { supabaseAdmin } = require('../config/supabase');
const redis = require('../config/redis');
const config = require('../config');
const { authLimit } = require('../middleware/rateLimit');
const { AppError } = require('../middleware/errorHandler');

// ── Validation Schemas ────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2).max(100),
  handle: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Handle: lowercase, numbers, underscores only'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ── Token Helpers ─────────────────────────────────────────────
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  const refreshToken = uuidv4(); // opaque token stored in DB
  return { accessToken, refreshToken };
}

async function storeRefreshToken(userId, refreshToken) {
  const hash = require('crypto')
    .createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

  await supabaseAdmin.from('refresh_tokens').insert({
    user_id: userId,
    token_hash: hash,
    expires_at: expiresAt.toISOString(),
  });
  return hash;
}

// ── POST /v1/auth/register ────────────────────────────────────
router.post('/register', authLimit, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    // Check handle uniqueness
    const { data: existing } = await supabaseAdmin
      .from('users').select('id').eq('handle', body.handle).single();
    if (existing) throw new AppError('Handle already taken', 400);

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: body.email,
        password_hash: passwordHash,
        name: body.name,
        handle: body.handle,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw new AppError('Email already registered', 400);
      throw error;
    }

    // Create default preferences
    await supabaseAdmin.from('user_preferences').insert({ user_id: user.id });

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      handle: user.handle,
      avatar_url: user.avatar_url,
      streak_count: user.streak_count,
      role: user.role ?? 'user',
      status: user.status ?? 'active',
      created_at: user.created_at,
    };

    const { accessToken, refreshToken } = generateTokens(user.id);
    await storeRefreshToken(user.id, refreshToken);

    res.status(201).json({ user: safeUser, accessToken, refreshToken });
  } catch (err) { next(err); }
});

// ── POST /v1/auth/login ───────────────────────────────────────
router.post('/login', authLimit, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      console.warn(`[auth] login failed: user not found for ${email}`);
      throw new AppError('Invalid email or password', 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.warn(`[auth] login failed: password mismatch for ${email}`);
      throw new AppError('Invalid email or password', 401);
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      handle: user.handle,
      avatar_url: user.avatar_url,
      streak_count: user.streak_count,
      role: user.role ?? 'user',
      status: user.status ?? 'active',
      created_at: user.created_at,
    };

    const { accessToken, refreshToken } = generateTokens(user.id);
    await storeRefreshToken(user.id, refreshToken);

    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) { next(err); }
});

// ── POST /v1/auth/refresh ─────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required', 400);

    const hash = require('crypto')
      .createHash('sha256').update(refreshToken).digest('hex');

    const { data: tokenRow, error } = await supabaseAdmin
      .from('refresh_tokens')
      .select('id, user_id, expires_at, revoked_at')
      .eq('token_hash', hash)
      .single();

    if (error || !tokenRow) throw new AppError('Invalid refresh token', 401);
    if (tokenRow.revoked_at) throw new AppError('Refresh token revoked', 401);
    if (new Date(tokenRow.expires_at) < new Date()) throw new AppError('Refresh token expired', 401);

    // Revoke old token (rotation)
    await supabaseAdmin.from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', tokenRow.id);

    // Issue new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(tokenRow.user_id);
    await storeRefreshToken(tokenRow.user_id, newRefreshToken);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) { next(err); }
});

// ── POST /v1/auth/logout ──────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const hash = require('crypto')
        .createHash('sha256').update(refreshToken).digest('hex');
      await supabaseAdmin.from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', hash);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
