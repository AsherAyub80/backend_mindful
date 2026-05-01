// src/routes/user.routes.js
const router = require('express').Router();
const { z } = require('zod');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// GET /v1/users/me
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// PATCH /v1/users/me
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const allowed = z.object({
      name: z.string().min(2).max(100).optional(),
      bio: z.string().max(300).optional(),
      avatar_url: z.string().url().optional(),
    }).parse(req.body);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ ...allowed, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('id, email, name, handle, avatar_url, bio, streak_count')
      .single();

    if (error) throw error;
    res.json({ user });
  } catch (err) { next(err); }
});

// GET /v1/users/me/preferences
router.get('/me/preferences', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.user.id)
      .single();
    if (error) throw error;
    res.json({ preferences: data });
  } catch (err) { next(err); }
});

// PUT /v1/users/me/preferences
router.put('/me/preferences', requireAuth, async (req, res, next) => {
  try {
    const prefs = z.object({
      dietary_tags: z.array(z.string()).optional(),
      allergy_tags: z.array(z.string()).optional(),
      goal_tags: z.array(z.string()).optional(),
      calorie_target: z.number().min(500).max(5000).optional(),
      notifications_on: z.boolean().optional(),
    }).parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .upsert({ ...prefs, user_id: req.user.id, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    res.json({ preferences: data });
  } catch (err) { next(err); }
});

// GET /v1/users/:handle — public profile
router.get('/:handle', async (req, res, next) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, name, handle, avatar_url, bio, streak_count, created_at')
      .eq('handle', req.params.handle)
      .single();
    if (error) throw new AppError('User not found', 404);
    res.json({ user });
  } catch (err) { next(err); }
});

// POST /v1/users/:id/follow
router.post('/:id/follow', requireAuth, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) throw new AppError("Can't follow yourself", 400);
    await supabaseAdmin.from('follows').upsert({
      follower_id: req.user.id, following_id: req.params.id,
    });
    res.json({ following: true });
  } catch (err) { next(err); }
});

// DELETE /v1/users/:id/follow
router.delete('/:id/follow', requireAuth, async (req, res, next) => {
  try {
    await supabaseAdmin.from('follows')
      .delete().eq('follower_id', req.user.id).eq('following_id', req.params.id);
    res.json({ following: false });
  } catch (err) { next(err); }
});

module.exports = router;
