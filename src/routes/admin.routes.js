// src/routes/admin.routes.js
// ─────────────────────────────────────────────────────────────
//  MindfulMeals Admin API  —  all routes require admin JWT
//  Base: /v1/admin
// ─────────────────────────────────────────────────────────────
const router = require('express').Router();
const { z }  = require('zod');
const { supabaseAdmin } = require('../config/supabase');
const { requireAdmin }  = require('../middleware/adminAuth');
const { AppError }      = require('../middleware/errorHandler');

router.use(requireAdmin);

// ════════════════════════════════════════════════════════════
//  DASHBOARD STATS  GET /v1/admin/stats
// ════════════════════════════════════════════════════════════
router.get('/stats', async (req, res, next) => {
  try {
    const [
      { count: totalUsers },
      { count: totalPosts },
      { count: totalMeals },
      { count: totalRestaurants },
      { count: flaggedPosts },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('meals').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
    ]);

    // User growth: last 8 months
    const userGrowth = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { count } = await supabaseAdmin
        .from('users').select('*', { count: 'exact', head: true }).lte('created_at', end);
      userGrowth.push({ month: d.toLocaleString('en', { month: 'short' }), users: count || 0 });
    }

    // Mood distribution last 7d
    const { data: moodLogs } = await supabaseAdmin
      .from('mood_logs').select('mood')
      .gte('logged_at', new Date(Date.now() - 7 * 86400000).toISOString());
    const moodCounts = { Calm: 0, Energized: 0, Comfort: 0, Focus: 0, Happy: 0 };
    moodLogs?.forEach(l => { if (moodCounts[l.mood] !== undefined) moodCounts[l.mood]++; });
    const total = Object.values(moodCounts).reduce((a, b) => a + b, 0) || 1;
    const moodDistribution = Object.entries(moodCounts).map(([name, val]) => ({
      name, value: Math.round((val / total) * 100),
    }));

    res.json({
      stats: {
        totalUsers: totalUsers || 0,
        totalPosts: totalPosts || 0,
        totalMeals: totalMeals || 0,
        totalRestaurants: totalRestaurants || 0,
        flaggedPosts: flaggedPosts || 0,
      },
      userGrowth,
      moodDistribution,
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
//  USERS
// ════════════════════════════════════════════════════════════
router.get('/users', async (req, res, next) => {
  try {
    const { search, status, role, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('users')
      .select('id, email, name, handle, avatar_url, role, status, streak_count, created_at', { count: 'exact' })
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,handle.ilike.%${search}%`);
    if (status) query = query.eq('status', status);
    if (role)   query = query.eq('role', role);

    const { data: users, error, count } = await query;
    if (error) throw error;

    // Enrich with post counts
    const ids = users?.map(u => u.id) || [];
    const { data: postCounts } = await supabaseAdmin.from('posts').select('user_id').in('user_id', ids);
    const pcMap = {};
    postCounts?.forEach(p => { pcMap[p.user_id] = (pcMap[p.user_id] || 0) + 1; });

    res.json({ users: users?.map(u => ({ ...u, posts: pcMap[u.id] || 0 })), total: count });
  } catch (err) { next(err); }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const body = z.object({
      role:   z.enum(['user', 'admin', 'moderator']).optional(),
      status: z.enum(['active', 'inactive', 'suspended']).optional(),
      name:   z.string().min(2).max(100).optional(),
    }).parse(req.body);

    const { data: user, error } = await supabaseAdmin
      .from('users').update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select('id, email, name, handle, role, status').single();

    if (error) throw error;
    res.json({ user });
  } catch (err) { next(err); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) throw new AppError('Cannot delete yourself', 400);
    await supabaseAdmin.from('users').delete().eq('id', req.params.id);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
//  MEALS
// ════════════════════════════════════════════════════════════
router.get('/meals', async (req, res, next) => {
  try {
    const { search, mood, published, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('meals')
      .select('*, meal_ingredients(id, name, quantity, sort_order), meal_steps(id, step_number, instruction)', { count: 'exact' })
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (search)    query = query.ilike('title', `%${search}%`);
    if (mood)      query = query.contains('mood_tags', [mood]);
    if (published !== undefined) query = query.eq('is_published', published === 'true');

    const { data: meals, error, count } = await query;
    if (error) throw error;

    // Enrich with save counts
    const mealIds = meals?.map(m => m.id) || [];
    const { data: saves } = await supabaseAdmin.from('saved_meals').select('meal_id').in('meal_id', mealIds);
    const saveMap = {};
    saves?.forEach(s => { saveMap[s.meal_id] = (saveMap[s.meal_id] || 0) + 1; });

    res.json({
      meals: meals?.map(m => ({
        ...m,
        saves: saveMap[m.id] || 0,
        meal_ingredients: m.meal_ingredients?.sort((a, b) => a.sort_order - b.sort_order),
        meal_steps: m.meal_steps?.sort((a, b) => a.step_number - b.step_number),
      })),
      total: count,
    });
  } catch (err) { next(err); }
});

router.post('/meals', async (req, res, next) => {
  try {
    const body = z.object({
      title:         z.string().min(2).max(200),
      description:   z.string().optional(),
      emoji:         z.string().max(10).optional(),
      prep_time_min: z.number().optional(),
      cook_time_min: z.number().optional(),
      calories:      z.number().optional(),
      protein_g:     z.number().optional(),
      carbs_g:       z.number().optional(),
      fat_g:         z.number().optional(),
      mood_tags:     z.array(z.string()).default([]),
      dietary_tags:  z.array(z.string()).default([]),
      image_url:     z.string().url().optional(),
      is_published:  z.boolean().default(true),
      ingredients:   z.array(z.object({ name: z.string(), quantity: z.string().optional(), sort_order: z.number().default(0) })).optional(),
      steps:         z.array(z.object({ step_number: z.number(), instruction: z.string() })).optional(),
    }).parse(req.body);

    const { ingredients, steps, ...mealData } = body;
    const { data: meal, error } = await supabaseAdmin
      .from('meals').insert({ ...mealData, created_by: req.user.id }).select().single();
    if (error) throw error;

    if (ingredients?.length)
      await supabaseAdmin.from('meal_ingredients').insert(ingredients.map(i => ({ ...i, meal_id: meal.id })));
    if (steps?.length)
      await supabaseAdmin.from('meal_steps').insert(steps.map(s => ({ ...s, meal_id: meal.id })));

    res.status(201).json({ meal });
  } catch (err) { next(err); }
});

router.patch('/meals/:id', async (req, res, next) => {
  try {
    const body = z.object({
      title:        z.string().min(2).max(200).optional(),
      description:  z.string().optional(),
      emoji:        z.string().max(10).optional(),
      prep_time_min: z.number().optional(),
      calories:     z.number().optional(),
      mood_tags:    z.array(z.string()).optional(),
      dietary_tags: z.array(z.string()).optional(),
      is_published: z.boolean().optional(),
      image_url:    z.string().url().optional(),
    }).parse(req.body);

    const { data: meal, error } = await supabaseAdmin
      .from('meals').update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ meal });
  } catch (err) { next(err); }
});

router.delete('/meals/:id', async (req, res, next) => {
  try {
    await supabaseAdmin.from('meals').delete().eq('id', req.params.id);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
//  RESTAURANTS
// ════════════════════════════════════════════════════════════
router.get('/restaurants', async (req, res, next) => {
  try {
    const { search, mood, active, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('restaurants')
      .select('*', { count: 'exact' })
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (search) query = query.ilike('name', `%${search}%`);
    if (mood)   query = query.contains('mood_tags', [mood]);
    if (active !== undefined) query = query.eq('is_active', active === 'true');

    const { data: restaurants, error, count } = await query;
    if (error) throw error;

    const rIds = restaurants?.map(r => r.id) || [];
    const { data: expCounts } = await supabaseAdmin
      .from('posts').select('restaurant_id').in('restaurant_id', rIds).eq('post_type', 'dining');
    const expMap = {};
    expCounts?.forEach(p => { expMap[p.restaurant_id] = (expMap[p.restaurant_id] || 0) + 1; });

    res.json({ restaurants: restaurants?.map(r => ({ ...r, experiences: expMap[r.id] || 0 })), total: count });
  } catch (err) { next(err); }
});

router.post('/restaurants', async (req, res, next) => {
  try {
    const body = z.object({
      name:           z.string().min(2).max(200),
      cuisine_tags:   z.array(z.string()).default([]),
      mood_tags:      z.array(z.string()).default([]),
      description:    z.string().optional(),
      address:        z.string().optional(),
      lat:            z.number().optional(),
      lng:            z.number().optional(),
      rating:         z.number().min(0).max(5).optional(),
      price_range:    z.number().min(1).max(4).default(2),
      emoji:          z.string().max(10).optional(),
      image_url:      z.string().url().optional(),
      menu_highlights: z.array(z.string()).default([]),
      is_active:      z.boolean().default(true),
    }).parse(req.body);

    const { data: restaurant, error } = await supabaseAdmin
      .from('restaurants').insert(body).select().single();
    if (error) throw error;
    res.status(201).json({ restaurant });
  } catch (err) { next(err); }
});

router.patch('/restaurants/:id', async (req, res, next) => {
  try {
    const body = z.object({
      name:           z.string().min(2).max(200).optional(),
      cuisine_tags:   z.array(z.string()).optional(),
      mood_tags:      z.array(z.string()).optional(),
      description:    z.string().optional(),
      address:        z.string().optional(),
      lat:            z.number().optional(),
      lng:            z.number().optional(),
      rating:         z.number().min(0).max(5).optional(),
      price_range:    z.number().min(1).max(4).optional(),
      emoji:          z.string().max(10).optional(),
      menu_highlights: z.array(z.string()).optional(),
      is_active:      z.boolean().optional(),
    }).parse(req.body);

    const { data: restaurant, error } = await supabaseAdmin
      .from('restaurants').update(body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ restaurant });
  } catch (err) { next(err); }
});

router.delete('/restaurants/:id', async (req, res, next) => {
  try {
    await supabaseAdmin.from('restaurants').delete().eq('id', req.params.id);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
//  POSTS (MODERATION)
// ════════════════════════════════════════════════════════════
router.get('/posts', async (req, res, next) => {
  try {
    const { flagged, status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('posts')
      .select(`id, post_type, note, mood_before, mood_after, image_url,
        like_count, comment_count, is_public, is_flagged, created_at,
        users!posts_user_id_fkey(id, name, handle, avatar_url),
        meals(id, title, emoji), restaurants(id, name, emoji)`, { count: 'exact' })
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (flagged !== undefined)  query = query.eq('is_flagged', flagged === 'true');
    if (status === 'hidden')    query = query.eq('is_public', false);
    if (status === 'published') query = query.eq('is_public', true);

    const { data: posts, error, count } = await query;
    if (error) throw error;
    res.json({ posts, total: count });
  } catch (err) { next(err); }
});

router.patch('/posts/:id/moderate', async (req, res, next) => {
  try {
    const { action } = z.object({
      action: z.enum(['approve', 'hide', 'flag', 'unflag']),
    }).parse(req.body);

    const updates = {
      approve: { is_public: true, is_flagged: false },
      hide:    { is_public: false },
      flag:    { is_flagged: true },
      unflag:  { is_flagged: false },
    }[action];

    const { data: post, error } = await supabaseAdmin
      .from('posts').update(updates).eq('id', req.params.id)
      .select('id, is_public, is_flagged').single();
    if (error) throw error;
    res.json({ post });
  } catch (err) { next(err); }
});

router.delete('/posts/:id', async (req, res, next) => {
  try {
    await supabaseAdmin.from('posts').delete().eq('id', req.params.id);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
//  ANALYTICS
// ════════════════════════════════════════════════════════════
router.get('/analytics/overview', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString();

    const { data: moodLogs } = await supabaseAdmin
      .from('mood_logs').select('mood, logged_at').gte('logged_at', since);

    const moodBreakdown = {};
    moodLogs?.forEach(l => { moodBreakdown[l.mood] = (moodBreakdown[l.mood] || 0) + 1; });

    const weeklyTrends = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
      const entry = { day, Calm: 0, Energized: 0, Comfort: 0, Focus: 0, Happy: 0 };
      moodLogs?.forEach(l => {
        const d = new Date(l.logged_at).toLocaleString('en', { weekday: 'short' });
        if (d === day && entry[l.mood] !== undefined) entry[l.mood]++;
      });
      return entry;
    });

    res.json({ moodLogs: moodLogs?.length || 0, moodBreakdown, weeklyTrends });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
//  AI STATUS
// ════════════════════════════════════════════════════════════
router.get('/ai-status', async (req, res, next) => {
  try {
    const cfg = require('../config');
    const t0 = Date.now();

    let fastApiStatus = 'offline', fastApiLatency = '—';
    try {
      const r = await fetch(`${cfg.aiService.url}/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) { fastApiStatus = 'online'; fastApiLatency = `${Date.now() - t0}ms`; }
    } catch {}

    let supabaseStatus = 'offline', supabaseLatency = '—';
    const t1 = Date.now();
    try {
      await supabaseAdmin.from('users').select('id', { head: true, count: 'exact' });
      supabaseStatus = 'online'; supabaseLatency = `${Date.now() - t1}ms`;
    } catch {}

    const redis = require('../config/redis');
    let redisStatus = 'offline';
    try { await redis.set('admin:ping', '1'); redisStatus = 'online'; } catch {}

    res.json({
      services: {
        fastapi:  { status: fastApiStatus,  latency: fastApiLatency },
        nodejs:   { status: 'online',        latency: `${Date.now() - t0}ms` },
        groq:     { status: cfg.groq.apiKey ? 'online' : 'offline' },
        supabase: { status: supabaseStatus,  latency: supabaseLatency },
        redis:    { status: redisStatus },
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════
router.get('/settings', async (req, res, next) => {
  try {
    const cfg = require('../config');
    res.json({
      settings: {
        apiBaseUrl:    `http://localhost:${cfg.port}/v1`,
        aiServiceUrl:  cfg.aiService.url,
        groqModel:     cfg.groq.model,
        groqFastModel: cfg.groq.fastModel,
        redisEnabled:  !!cfg.redis.url,
        nodeEnv:       cfg.nodeEnv,
        radiusKm:      2,
        aiLimit:       5,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
