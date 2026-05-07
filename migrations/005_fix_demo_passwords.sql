-- ============================================================
-- MindfulMeals - Fix demo user password hashes
-- Run this on databases seeded before the password123 hash fix
-- ============================================================

UPDATE users
SET password_hash = '$2a$12$9AvUbnk4Rv7dagWnKR3Pd.DOlGZXLNeEi3worsROmNobjIYED0uNq',
    updated_at = NOW()
WHERE email IN ('alex@demo.com', 'aria@demo.com', 'marcus@demo.com');

SELECT '005_fix_demo_passwords complete' AS status;
