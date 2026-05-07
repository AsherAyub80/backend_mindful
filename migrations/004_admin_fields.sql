-- migrations/004_admin_fields.sql
-- Adds admin-required columns to existing tables
-- Run AFTER 003_analytics.sql in Supabase SQL Editor

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.users. Run backend/migrations/001_init.sql first, then rerun this migration.';
  END IF;

  IF to_regclass('public.posts') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.posts. Run backend/migrations/001_init.sql first, then rerun this migration.';
  END IF;
END $$;

-- Add role + status to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role   VARCHAR(20) DEFAULT 'user'
    CHECK (role IN ('user','admin','moderator')),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','inactive','suspended'));

-- Add is_flagged to posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;

-- Index for fast admin queries
CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status  ON users(status);
CREATE INDEX IF NOT EXISTS idx_posts_flagged ON posts(is_flagged) WHERE is_flagged = TRUE;

-- ─────────────────────────────────────────────────────────────
-- IMPORTANT: Make yourself an admin after running this.
-- Replace the email below with your actual email:
-- ─────────────────────────────────────────────────────────────
-- UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
-- 
-- For demo, make alex admin:
-- UPDATE users SET role = 'admin' WHERE email = 'alex@demo.com';
-- ─────────────────────────────────────────────────────────────

SELECT '004_admin_fields migration complete ✅' AS status;
