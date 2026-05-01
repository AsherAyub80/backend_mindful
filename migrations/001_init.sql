-- ============================================================
-- MindfulMeals — Complete Database Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- for semantic search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "earthdistance"; -- for geo distance
CREATE EXTENSION IF NOT EXISTS "cube";          -- required by earthdistance

-- ── Helper: auto-update updated_at ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════
-- USERS & AUTH
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255),
  name            VARCHAR(100) NOT NULL,
  handle          VARCHAR(50)  UNIQUE NOT NULL,
  avatar_url      TEXT,
  bio             TEXT,
  streak_count    INT DEFAULT 0,
  streak_last_at  TIMESTAMPTZ,
  oauth_provider  VARCHAR(20),
  oauth_id        VARCHAR(255),
  is_verified     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

-- ── Refresh Tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL,
  device_info  TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_hash
  ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

-- ── User Preferences ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  dietary_tags      TEXT[] DEFAULT '{}',
  allergy_tags      TEXT[] DEFAULT '{}',
  goal_tags         TEXT[] DEFAULT '{}',
  disliked_cuisines TEXT[] DEFAULT '{}',
  calorie_target    INT DEFAULT 2000,
  notifications_on  BOOLEAN DEFAULT TRUE,
  meal_reminder_at  TIME,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- MOOD TRACKING
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mood_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  mood            VARCHAR(50) NOT NULL
                  CHECK (mood IN ('Calm','Energized','Comfort','Focus','Happy')),
  mood_score      SMALLINT CHECK (mood_score BETWEEN 1 AND 10),
  context         VARCHAR(10) CHECK (context IN ('cook','dining')),
  meal_id         UUID,
  restaurant_id   UUID,
  logged_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_user
  ON mood_logs(user_id, logged_at DESC);

-- ════════════════════════════════════════════════════════════
-- MEALS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS meals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  emoji           VARCHAR(10),
  prep_time_min   SMALLINT,
  cook_time_min   SMALLINT,
  calories        INT,
  protein_g       DECIMAL(6,2),
  carbs_g         DECIMAL(6,2),
  fat_g           DECIMAL(6,2),
  mood_tags       TEXT[] DEFAULT '{}',
  dietary_tags    TEXT[] DEFAULT '{}',
  image_url       TEXT,
  embedding       VECTOR(384),  -- 384-dim for local free models; 1536 for OpenAI
  is_published    BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER meals_updated_at
  BEFORE UPDATE ON meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_meals_mood
  ON meals USING GIN(mood_tags);
CREATE INDEX IF NOT EXISTS idx_meals_dietary
  ON meals USING GIN(dietary_tags);
CREATE INDEX IF NOT EXISTS idx_meals_title_search
  ON meals USING GIN(title gin_trgm_ops);
-- Vector index (create after loading data):
-- CREATE INDEX idx_meals_embedding
--   ON meals USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── Ingredients ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_ingredients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id     UUID REFERENCES meals(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  quantity    VARCHAR(80),
  sort_order  SMALLINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ingredients_meal ON meal_ingredients(meal_id);

-- ── Steps ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id      UUID REFERENCES meals(id) ON DELETE CASCADE,
  step_number  SMALLINT NOT NULL,
  instruction  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_steps_meal ON meal_steps(meal_id);

-- ── Saved Meals ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_meals (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  meal_id    UUID REFERENCES meals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, meal_id)
);

-- ════════════════════════════════════════════════════════════
-- RESTAURANTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS restaurants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  cuisine_tags  TEXT[] DEFAULT '{}',
  mood_tags     TEXT[] DEFAULT '{}',
  description   TEXT,
  address       VARCHAR(300),
  lat           DECIMAL(10,8),
  lng           DECIMAL(11,8),
  rating        DECIMAL(3,2) CHECK (rating BETWEEN 0 AND 5),
  review_count  INT DEFAULT 0,
  price_range   SMALLINT CHECK (price_range BETWEEN 1 AND 4),
  emoji         VARCHAR(10),
  image_url     TEXT,
  open_hours    JSONB DEFAULT '{}',
  place_id      VARCHAR(100) UNIQUE,
  phone         VARCHAR(30),
  website       TEXT,
  menu_highlights TEXT[] DEFAULT '{}',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_location
  ON restaurants USING gist(ll_to_earth(lat, lng));
CREATE INDEX IF NOT EXISTS idx_restaurants_mood
  ON restaurants USING GIN(mood_tags);
CREATE INDEX IF NOT EXISTS idx_restaurants_active
  ON restaurants(is_active) WHERE is_active = TRUE;

-- ════════════════════════════════════════════════════════════
-- COMMUNITY POSTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  post_type       VARCHAR(10) NOT NULL
                  CHECK (post_type IN ('recipe','dining')),
  meal_id         UUID REFERENCES meals(id) ON DELETE SET NULL,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  note            TEXT,
  image_url       TEXT,
  mood_before     VARCHAR(50),
  mood_after      VARCHAR(50),
  ordered_items   TEXT,
  like_count      INT DEFAULT 0,
  comment_count   INT DEFAULT 0,
  save_count      INT DEFAULT 0,
  is_public       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_posts_user
  ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_public_feed
  ON posts(created_at DESC) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_posts_restaurant
  ON posts(restaurant_id) WHERE restaurant_id IS NOT NULL;

-- ── Post Interactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_interactions (
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('like','save','share')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_interactions_user ON post_interactions(user_id);

-- ── Comments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

-- ── Follows ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ── AI Recommendations Log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  mood                VARCHAR(50),
  context             VARCHAR(10),
  recommended_ids     UUID[],
  model_version       VARCHAR(80),
  prompt_tokens       INT,
  completion_tokens   INT,
  latency_ms          INT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS (called from Node.js via supabase.rpc)
-- ════════════════════════════════════════════════════════════

-- Safely increment a counter column on posts
CREATE OR REPLACE FUNCTION increment_post_count(post_id UUID, col TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE posts SET %I = %I + 1 WHERE id = $1', col, col)
  USING post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safely decrement (floor at 0)
CREATE OR REPLACE FUNCTION decrement_post_count(post_id UUID, col TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE posts SET %I = GREATEST(0, %I - 1) WHERE id = $1', col, col)
  USING post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get nearby restaurants within radius_km
CREATE OR REPLACE FUNCTION nearby_restaurants(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 2.0,
  mood_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, name VARCHAR, cuisine_tags TEXT[], mood_tags TEXT[],
  description TEXT, address VARCHAR, lat DECIMAL, lng DECIMAL,
  rating DECIMAL, price_range SMALLINT, emoji VARCHAR,
  image_url TEXT, menu_highlights TEXT[],
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id, r.name, r.cuisine_tags, r.mood_tags,
    r.description, r.address, r.lat, r.lng,
    r.rating, r.price_range, r.emoji,
    r.image_url, r.menu_highlights,
    (earth_distance(
      ll_to_earth(user_lat, user_lng),
      ll_to_earth(r.lat, r.lng)
    ) / 1000.0)::FLOAT AS distance_km
  FROM restaurants r
  WHERE
    r.is_active = TRUE
    AND earth_distance(
      ll_to_earth(user_lat, user_lng),
      ll_to_earth(r.lat, r.lng)
    ) <= radius_km * 1000
    AND (mood_filter IS NULL OR mood_filter = ANY(r.mood_tags))
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════

-- Enable RLS on sensitive tables
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meals      ENABLE ROW LEVEL SECURITY;

-- Users: public read of safe fields, own row full access
CREATE POLICY "Users are viewable by everyone"
  ON users FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Preferences: private to owner
CREATE POLICY "Preferences are private"
  ON user_preferences FOR ALL USING (auth.uid()::text = user_id::text);

-- Mood logs: private to owner
CREATE POLICY "Mood logs are private"
  ON mood_logs FOR ALL USING (auth.uid()::text = user_id::text);

-- Saved meals: private to owner
CREATE POLICY "Saved meals are private"
  ON saved_meals FOR ALL USING (auth.uid()::text = user_id::text);

-- Posts: public read if is_public, own row full access
CREATE POLICY "Public posts are viewable"
  ON posts FOR SELECT USING (is_public = TRUE OR auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage own posts"
  ON posts FOR ALL USING (auth.uid()::text = user_id::text);

-- NOTE: Our Node.js backend uses service_role key which bypasses RLS.
-- RLS protects direct Supabase client access from the Flutter app.

-- ════════════════════════════════════════════════════════════
-- STORAGE BUCKETS  (run in Supabase dashboard or via API)
-- ════════════════════════════════════════════════════════════

-- Run these as separate SQL or in Supabase Storage UI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-images', 'recipe-images', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('profile-avatars', 'profile-avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true);

SELECT 'Migration complete! ✅' AS status;
