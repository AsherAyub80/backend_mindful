-- ============================================================
-- Migration 003 — FCM tokens, saved items, analytics views
-- Run after 001_init.sql in Supabase SQL Editor
-- ============================================================

-- ── FCM Push Notification Tokens ─────────────────────────────
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  device_info TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fcm_user ON fcm_tokens(user_id);

-- ── Saved Restaurants (mirror of saved_meals pattern) ────────
CREATE TABLE IF NOT EXISTS saved_restaurants (
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, restaurant_id)
);

-- ── Analytics: User Activity Summary View ────────────────────
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT
  u.id,
  u.name,
  u.handle,
  u.streak_count,
  COUNT(DISTINCT ml.id)         AS total_mood_logs,
  COUNT(DISTINCT p.id)          AS total_posts,
  COUNT(DISTINCT pi.post_id)    AS total_likes_given,
  COUNT(DISTINCT f.following_id) AS following_count,
  COUNT(DISTINCT f2.follower_id) AS follower_count,
  MAX(ml.logged_at)             AS last_mood_logged_at
FROM users u
LEFT JOIN mood_logs        ml ON ml.user_id = u.id
LEFT JOIN posts            p  ON p.user_id  = u.id
LEFT JOIN post_interactions pi ON pi.user_id = u.id AND pi.type = 'like'
LEFT JOIN follows           f  ON f.follower_id  = u.id
LEFT JOIN follows           f2 ON f2.following_id = u.id
GROUP BY u.id, u.name, u.handle, u.streak_count;

-- ── Analytics: Mood Trend by Day ─────────────────────────────
CREATE OR REPLACE VIEW mood_daily_trends AS
SELECT
  user_id,
  DATE(logged_at)           AS log_date,
  mood,
  COUNT(*)                  AS log_count,
  AVG(mood_score)           AS avg_score,
  MODE() WITHIN GROUP (ORDER BY context) AS primary_context
FROM mood_logs
GROUP BY user_id, DATE(logged_at), mood;

-- ── Analytics: Top Meals by Mood ─────────────────────────────
CREATE OR REPLACE VIEW top_meals_by_mood AS
SELECT
  m.id,
  m.title,
  m.emoji,
  unnest(m.mood_tags)       AS mood,
  COUNT(DISTINCT p.id)      AS post_count,
  COUNT(DISTINCT pi.user_id) AS like_count,
  AVG(m.calories)           AS avg_calories
FROM meals m
LEFT JOIN posts            p  ON p.meal_id = m.id
LEFT JOIN post_interactions pi ON pi.post_id = p.id AND pi.type = 'like'
GROUP BY m.id, m.title, m.emoji, unnest(m.mood_tags)
ORDER BY like_count DESC;

-- ── Analytics: Restaurant Experience Sentiment ────────────────
CREATE OR REPLACE VIEW restaurant_mood_impact AS
SELECT
  r.id,
  r.name,
  r.emoji,
  COUNT(p.id)               AS experience_count,
  AVG(r.rating)             AS avg_rating,
  -- Count how many posts show mood improvement
  SUM(CASE
    WHEN p.mood_before IS NOT NULL AND p.mood_after IS NOT NULL
     AND p.mood_after != p.mood_before THEN 1
    ELSE 0
  END)                      AS mood_improvements
FROM restaurants r
LEFT JOIN posts p ON p.restaurant_id = r.id AND p.post_type = 'dining'
GROUP BY r.id, r.name, r.emoji;

-- ── RLS for new tables ────────────────────────────────────────
ALTER TABLE fcm_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_restaurants  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FCM tokens are private"
  ON fcm_tokens FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Saved restaurants are private"
  ON saved_restaurants FOR ALL USING (auth.uid()::text = user_id::text);

SELECT '003_analytics migration complete ✅' AS status;
