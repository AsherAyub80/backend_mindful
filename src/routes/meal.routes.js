const router = require('express').Router();
const { z } = require('zod');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { aiLimit, generalLimit } = require('../middleware/rateLimit');
const { getAIMealRecommendations, smartMealSearch } = require('../services/ai.service');
const { AppError } = require('../middleware/errorHandler');

router.get('/', requireAuth, generalLimit, async (req, res, next) => {
  try {
    const { mood, dietary, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('meals')
      .select('id, title, description, calories, prep_time_min, cook_time_min, mood_tags, dietary_tags, emoji, image_url', { count: 'exact' })
      .eq('is_published', true)
      .range(offset, offset + parseInt(limit) - 1);

    if (mood) query = query.contains('mood_tags', [mood]);
    if (dietary) query = query.contains('dietary_tags', [dietary]);

    const { data: meals, error, count } = await query;
    if (error) throw error;

    res.json({ meals, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

router.get('/saved', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_meals')
      .select('meal_id, meals(id, title, emoji, calories, prep_time_min, image_url)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ meals: data.map((entry) => entry.meals) });
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: meal, error } = await supabaseAdmin
      .from('meals')
      .select(`
        *,
        meal_ingredients (id, name, quantity, sort_order),
        meal_steps (id, step_number, instruction)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw new AppError('Meal not found', 404);

    meal.meal_ingredients?.sort((a, b) => a.sort_order - b.sort_order);
    meal.meal_steps?.sort((a, b) => a.step_number - b.step_number);

    res.json({ meal });
  } catch (err) { next(err); }
});

router.post('/ai-suggest', requireAuth, aiLimit, async (req, res, next) => {
  try {
    const { mood, limit = 5 } = z.object({
      mood: z.enum(['Calm', 'Energized', 'Comfort', 'Focus', 'Happy']),
      limit: z.number().min(1).max(10).optional(),
    }).parse(req.body);

    await supabaseAdmin.from('mood_logs').insert({
      user_id: req.user.id,
      mood,
      context: 'cook',
    });

    const result = await getAIMealRecommendations({
      mood,
      userId: req.user.id,
      limit,
    });

    res.json(result);
  } catch (err) { next(err); }
});

router.post('/search', requireAuth, async (req, res, next) => {
  try {
    const { query } = z.object({ query: z.string().min(3).max(200) }).parse(req.body);
    const result = await smartMealSearch(query, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/save', requireAuth, async (req, res, next) => {
  try {
    await supabaseAdmin.from('saved_meals').upsert({
      user_id: req.user.id,
      meal_id: req.params.id,
    });
    res.json({ saved: true });
  } catch (err) { next(err); }
});

router.delete('/:id/save', requireAuth, async (req, res, next) => {
  try {
    await supabaseAdmin.from('saved_meals')
      .delete()
      .eq('user_id', req.user.id)
      .eq('meal_id', req.params.id);
    res.json({ saved: false });
  } catch (err) { next(err); }
});

module.exports = router;
