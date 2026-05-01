// src/routes/mood.routes.js
const router = require('express').Router();
const { z } = require('zod');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { getMoodInsights, getMoodIntent } = require('../services/ai.service');

// POST /v1/moods — log a mood
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { mood, mood_score, context } = z.object({
      mood: z.enum(['Calm', 'Energized', 'Comfort', 'Focus', 'Happy']),
      mood_score: z.number().min(1).max(10).optional(),
      context: z.enum(['cook', 'dining']).optional(),
    }).parse(req.body);

    const { data: log, error } = await supabaseAdmin
      .from('mood_logs')
      .insert({ user_id: req.user.id, mood, mood_score, context })
      .select()
      .single();

    if (error) throw error;

    // Get AI intent for this mood (gives user immediate value)
    const intent = await getMoodIntent(mood);

    res.status(201).json({ log, intent });
  } catch (err) { next(err); }
});

// GET /v1/moods/history
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error } = await supabaseAdmin
      .from('mood_logs')
      .select('id, mood, mood_score, context, logged_at')
      .eq('user_id', req.user.id)
      .gte('logged_at', since)
      .order('logged_at', { ascending: false });

    if (error) throw error;
    res.json({ logs });
  } catch (err) { next(err); }
});

// GET /v1/moods/insights — AI-generated weekly summary
router.get('/insights', requireAuth, async (req, res, next) => {
  try {
    const insights = await getMoodInsights(req.user.id);
    res.json({ insights });
  } catch (err) { next(err); }
});

module.exports = router;
