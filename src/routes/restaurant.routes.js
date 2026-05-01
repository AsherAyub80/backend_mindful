// src/routes/restaurant.routes.js
const router = require('express').Router();
const { z } = require('zod');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { aiLimit, generalLimit } = require('../middleware/rateLimit');
const { getAIRestaurantRecommendations } = require('../services/ai.service');
const { AppError } = require('../middleware/errorHandler');

// GET /v1/restaurants/nearby — mood-matched restaurants
router.get('/nearby', requireAuth, aiLimit, async (req, res, next) => {
  try {
    const { lat, lng, mood, radius = 2 } = z.object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      mood: z.enum(['Calm', 'Energized', 'Comfort', 'Focus', 'Happy']).optional(),
      radius: z.coerce.number().min(0.5).max(10).optional(),
    }).parse(req.query);

    // Log the mood for dining context
    if (mood) {
      await supabaseAdmin.from('mood_logs').insert({
        user_id: req.user.id,
        mood,
        context: 'dining',
      });
    }

    const result = await getAIRestaurantRecommendations({
      mood: mood || 'Happy',
      lat,
      lng,
      userId: req.user.id,
      radiusKm: radius,
    });

    res.json(result);
  } catch (err) { next(err); }
});

// GET /v1/restaurants/:id — restaurant detail
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: restaurant, error } = await supabaseAdmin
      .from('restaurants')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw new AppError('Restaurant not found', 404);
    res.json({ restaurant });
  } catch (err) { next(err); }
});

// GET /v1/restaurants/:id/experiences — community posts for this restaurant
router.get('/:id/experiences', requireAuth, generalLimit, async (req, res, next) => {
  try {
    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id, note, mood_before, mood_after, ordered_items, image_url, like_count, comment_count, created_at,
        users!posts_user_id_fkey(id, name, handle, avatar_url)
      `)
      .eq('restaurant_id', req.params.id)
      .eq('post_type', 'dining')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ posts });
  } catch (err) { next(err); }
});

module.exports = router;
