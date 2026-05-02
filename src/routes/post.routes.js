// src/routes/post.routes.js
const router = require('express').Router();
const { z } = require('zod');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { generalLimit } = require('../middleware/rateLimit');
const { AppError } = require('../middleware/errorHandler');

const multer = require('multer');
const storageService = require('../services/storage.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const createPostSchema = z.object({
  post_type: z.enum(['recipe', 'dining']),
  meal_id: z.string().uuid().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  restaurant_id: z.string().uuid().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  note: z.string().max(500).optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  mood_before: z.string().max(50).optional(),
  mood_after: z.string().max(50).optional(),
  ordered_items: z.string().max(300).optional(),
  is_public: z.preprocess((val) => val === 'true' || val === true || val === undefined, z.boolean()).default(true),
});

// GET /v1/posts/feed
router.get('/feed', requireAuth, generalLimit, async (req, res, next) => {
  try {
    const { type = 'all', cursor, limit = 20 } = req.query;

    let query = supabaseAdmin
      .from('posts')
      .select(`
        id, post_type, note, mood_before, mood_after, ordered_items, image_url,
        like_count, comment_count, save_count, created_at,
        users!posts_user_id_fkey(id, name, handle, avatar_url),
        meals(id, title, emoji, image_url),
        restaurants(id, name, emoji)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (type !== 'all') query = query.eq('post_type', type);
    if (cursor) query = query.lt('created_at', cursor);

    const { data: posts, error } = await query;
    if (error) throw error;

    // Check which posts the current user has liked/saved
    if (posts?.length > 0) {
      const postIds = posts.map(p => p.id);
      const { data: interactions } = await supabaseAdmin
        .from('post_interactions')
        .select('post_id, type')
        .eq('user_id', req.user.id)
        .in('post_id', postIds);

      const interactionMap = {};
      interactions?.forEach(i => {
        if (!interactionMap[i.post_id]) interactionMap[i.post_id] = {};
        interactionMap[i.post_id][i.type] = true;
      });

      posts.forEach(p => {
        p.liked = !!interactionMap[p.id]?.like;
        p.saved = !!interactionMap[p.id]?.save;
      });
    }

    const nextCursor = posts?.length === parseInt(limit)
      ? posts[posts.length - 1]?.created_at
      : null;

    res.json({ posts: posts || [], nextCursor });
  } catch (err) { next(err); }
});

// POST /v1/posts
router.post('/', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const body = createPostSchema.parse(req.body);

    // Handle image upload if file is present
    if (req.file) {
      const uploadResult = await storageService.uploadImage(
        req.file.buffer,
        req.user.id,
        'post'
      );
      body.image_url = uploadResult.url;
    }

    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .insert({ ...body, user_id: req.user.id })
      .select('*, users!posts_user_id_fkey(id, name, handle, avatar_url)')
      .single();

    if (error) throw error;

    // Update streak
    await updateStreak(req.user.id);

    res.status(201).json({ post });
  } catch (err) { next(err); }
});

// POST /v1/posts/:id/like
router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    await supabaseAdmin.from('post_interactions').upsert({
      post_id: req.params.id, user_id: req.user.id, type: 'like',
    });
    await supabaseAdmin.rpc('increment_post_count', { post_id: req.params.id, col: 'like_count' });
    res.json({ liked: true });
  } catch (err) { next(err); }
});

// DELETE /v1/posts/:id/like
router.delete('/:id/like', requireAuth, async (req, res, next) => {
  try {
    await supabaseAdmin.from('post_interactions')
      .delete().eq('post_id', req.params.id).eq('user_id', req.user.id).eq('type', 'like');
    await supabaseAdmin.rpc('decrement_post_count', { post_id: req.params.id, col: 'like_count' });
    res.json({ liked: false });
  } catch (err) { next(err); }
});

// GET /v1/posts/:id/comments
router.get('/:id/comments', optionalAuth, async (req, res, next) => {
  try {
    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select('id, body, created_at, parent_id, users!comments_user_id_fkey(id, name, handle, avatar_url)')
      .eq('post_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ comments });
  } catch (err) { next(err); }
});

// POST /v1/posts/:id/comments
router.post('/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const { body, parent_id } = z.object({
      body: z.string().min(1).max(500),
      parent_id: z.string().uuid().optional(),
    }).parse(req.body);

    const { data: comment, error } = await supabaseAdmin
      .from('comments')
      .insert({ post_id: req.params.id, user_id: req.user.id, body, parent_id })
      .select('id, body, created_at, users!comments_user_id_fkey(id, name, handle, avatar_url)')
      .single();

    if (error) throw error;

    await supabaseAdmin.rpc('increment_post_count', { post_id: req.params.id, col: 'comment_count' });
    res.status(201).json({ comment });
  } catch (err) { next(err); }
});

async function updateStreak(userId) {
  try {
    const { data: user } = await supabaseAdmin
      .from('users').select('streak_count, streak_last_at').eq('id', userId).single();
    if (!user) return;

    const now = new Date();
    const lastAt = user.streak_last_at ? new Date(user.streak_last_at) : null;
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);

    let newStreak = user.streak_count;
    if (!lastAt || lastAt < twoDaysAgo) newStreak = 1; // reset
    else if (lastAt < oneDayAgo) newStreak += 1; // continue

    await supabaseAdmin.from('users').update({
      streak_count: newStreak, streak_last_at: now.toISOString(),
    }).eq('id', userId);
  } catch { /* non-critical, ignore */ }
}

module.exports = router;
