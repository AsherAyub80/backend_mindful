-- ============================================================
-- MindfulMeals — Seed Data
-- Run AFTER migration in Supabase SQL Editor
-- ============================================================

-- ── Sample Users ─────────────────────────────────────────────
-- Password for all: "password123" (bcrypt hash)
INSERT INTO users (id, email, password_hash, name, handle, bio, streak_count) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alex@demo.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QvDRNSVQe',
   'Alex Rivers', 'alex_mindful', 'Plant-based explorer 🌿', 7),
  ('22222222-2222-2222-2222-222222222222', 'aria@demo.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QvDRNSVQe',
   'Aria Chen', 'aria_eats', 'Food photographer & wellness advocate ✨', 12),
  ('33333333-3333-3333-3333-333333333333', 'marcus@demo.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QvDRNSVQe',
   'Marcus Lee', 'mindful_marcus', 'Mindfulness coach & home chef 🧘', 5)
ON CONFLICT DO NOTHING;

INSERT INTO user_preferences (user_id, dietary_tags, allergy_tags, goal_tags, calorie_target) VALUES
  ('11111111-1111-1111-1111-111111111111', ARRAY['vegan','gluten-free'], ARRAY['tree-nuts'], ARRAY['weight-balance','mindfulness'], 1800),
  ('22222222-2222-2222-2222-222222222222', ARRAY['vegetarian'],          ARRAY['shellfish'], ARRAY['energy','focus'], 2000),
  ('33333333-3333-3333-3333-333333333333', ARRAY['plant-based'],         ARRAY[]::TEXT[],    ARRAY['sleep','stress-relief'], 2200)
ON CONFLICT DO NOTHING;

-- ── Meals ─────────────────────────────────────────────────────
INSERT INTO meals (id, title, description, emoji, prep_time_min, cook_time_min, calories, protein_g, carbs_g, fat_g, mood_tags, dietary_tags) VALUES
  ('aaaa0001-0000-0000-0000-000000000000',
   'Zen Buddha Bowl',
   'A nourishing bowl bringing balance to your plate. Roasted chickpeas, brown rice, massaged kale, avocado, and a creamy tahini drizzle.',
   '🥗', 15, 25, 420, 18.0, 52.0, 16.0,
   ARRAY['Calm','Focus'], ARRAY['vegan','gluten-free']),

  ('aaaa0002-0000-0000-0000-000000000000',
   'Sunrise Smoothie Bowl',
   'A vibrant açaí base topped with fresh mango, granola, chia seeds, and honey. Pure morning energy in a bowl.',
   '🍓', 10, 0, 320, 8.0, 62.0, 6.0,
   ARRAY['Energized','Happy'], ARRAY['vegan','gluten-free']),

  ('aaaa0003-0000-0000-0000-000000000000',
   'Mindful Ramen',
   'A deeply comforting miso broth with tofu, bok choy, soft-boiled egg, and hand-pulled noodles. Warm your soul.',
   '🍜', 20, 25, 580, 24.0, 68.0, 18.0,
   ARRAY['Comfort','Calm'], ARRAY['vegetarian']),

  ('aaaa0004-0000-0000-0000-000000000000',
   'Serenity Salad',
   'Crisp romaine, cucumber, radish, and edamame with a ginger-sesame dressing. Light, clean, and refreshing.',
   '🥙', 15, 0, 280, 12.0, 28.0, 14.0,
   ARRAY['Calm','Focus'], ARRAY['vegan','gluten-free','raw']),

  ('aaaa0005-0000-0000-0000-000000000000',
   'Golden Turmeric Oats',
   'Creamy overnight oats with turmeric, cinnamon, almond milk, and a swirl of almond butter. Anti-inflammatory and warming.',
   '🌾', 5, 0, 380, 14.0, 58.0, 10.0,
   ARRAY['Calm','Comfort'], ARRAY['vegan','gluten-free']),

  ('aaaa0006-0000-0000-0000-000000000000',
   'Power Green Smoothie',
   'Spinach, banana, spirulina, hemp seeds, and coconut water blended to perfection. Pure plant power.',
   '🥤', 5, 0, 260, 10.0, 40.0, 7.0,
   ARRAY['Energized','Focus'], ARRAY['vegan','gluten-free','raw']),

  ('aaaa0007-0000-0000-0000-000000000000',
   'Comfort Lentil Soup',
   'Red lentils with cumin, coriander, and lemon. Slow-simmered with tomato and spinach into a silky, hearty soup.',
   '🍲', 10, 30, 340, 20.0, 48.0, 6.0,
   ARRAY['Comfort','Calm'], ARRAY['vegan','gluten-free']),

  ('aaaa0008-0000-0000-0000-000000000000',
   'Focus Grain Bowl',
   'Quinoa, roasted sweet potato, pumpkin seeds, kale, and a lemon-tahini dressing. Brain food.',
   '🫘', 10, 30, 460, 16.0, 62.0, 16.0,
   ARRAY['Focus','Energized'], ARRAY['vegan','gluten-free']),

  ('aaaa0009-0000-0000-0000-000000000000',
   'Happy Mango Tacos',
   'Crispy black bean tacos with mango salsa, purple cabbage slaw, and chipotle cashew cream.',
   '🌮', 20, 15, 520, 18.0, 70.0, 18.0,
   ARRAY['Happy','Energized'], ARRAY['vegan']),

  ('aaaa0010-0000-0000-0000-000000000000',
   'Lavender Chia Pudding',
   'Creamy coconut chia pudding infused with culinary lavender, topped with blueberries and honey.',
   '💜', 10, 0, 290, 8.0, 36.0, 14.0,
   ARRAY['Calm','Comfort'], ARRAY['vegan','gluten-free'])
ON CONFLICT DO NOTHING;

-- ── Ingredients for Zen Buddha Bowl ──────────────────────────
INSERT INTO meal_ingredients (meal_id, name, quantity, sort_order) VALUES
  ('aaaa0001-0000-0000-0000-000000000000', 'Brown rice',          '1 cup',       1),
  ('aaaa0001-0000-0000-0000-000000000000', 'Chickpeas, roasted',  '1 cup',       2),
  ('aaaa0001-0000-0000-0000-000000000000', 'Avocado, sliced',     '1 whole',     3),
  ('aaaa0001-0000-0000-0000-000000000000', 'Kale, massaged',      '2 cups',      4),
  ('aaaa0001-0000-0000-0000-000000000000', 'Beet, thinly sliced', '1 small',     5),
  ('aaaa0001-0000-0000-0000-000000000000', 'Tahini',              '2 tbsp',      6),
  ('aaaa0001-0000-0000-0000-000000000000', 'Lemon, juiced',       '1 whole',     7),
  ('aaaa0001-0000-0000-0000-000000000000', 'Sesame seeds',        '1 tsp',       8),
  ('aaaa0001-0000-0000-0000-000000000000', 'Sea salt',            'Pinch',       9)
ON CONFLICT DO NOTHING;

-- ── Steps for Zen Buddha Bowl ─────────────────────────────────
INSERT INTO meal_steps (meal_id, step_number, instruction) VALUES
  ('aaaa0001-0000-0000-0000-000000000000', 1, 'Cook brown rice according to package directions and let cool slightly.'),
  ('aaaa0001-0000-0000-0000-000000000000', 2, 'Toss chickpeas in olive oil, smoked paprika, and salt. Roast at 400°F for 25 minutes until crispy.'),
  ('aaaa0001-0000-0000-0000-000000000000', 3, 'Massage kale with a drizzle of olive oil and a pinch of sea salt for 2 minutes until softened.'),
  ('aaaa0001-0000-0000-0000-000000000000', 4, 'Whisk tahini, lemon juice, 2 tbsp water, and a pinch of garlic powder into a smooth dressing.'),
  ('aaaa0001-0000-0000-0000-000000000000', 5, 'Assemble bowl: rice as base, then arrange chickpeas, kale, avocado, and beet. Drizzle with tahini dressing and sprinkle sesame seeds.')
ON CONFLICT DO NOTHING;

-- ── Restaurants ───────────────────────────────────────────────
INSERT INTO restaurants (id, name, cuisine_tags, mood_tags, description, address, lat, lng, rating, price_range, emoji, menu_highlights) VALUES
  ('bbbb0001-0000-0000-0000-000000000000',
   'The Zen Garden', ARRAY['Japanese','Vegan'], ARRAY['Calm','Focus'],
   'A tranquil Japanese-inspired space with plant-based bento boxes, matcha drinks, and a bamboo-lined interior designed for mindful dining.',
   '42 Serenity Lane, Midtown', 40.7580, -73.9855, 4.8, 2, '🍵',
   ARRAY['Matcha Buddha Bowl','Tempeh Bento','Ginger Miso Soup','Cold Brew Matcha']),

  ('bbbb0002-0000-0000-0000-000000000000',
   'Bloom Kitchen', ARRAY['Mediterranean','Healthy'], ARRAY['Happy','Energized','Calm'],
   'A bright, airy Mediterranean kitchen celebrating seasonal vegetables and whole grains. Perfect for a nourishing lunch.',
   '8 Blossom Street, Garden District', 40.7614, -73.9776, 4.6, 2, '🌸',
   ARRAY['Quinoa Mezze Platter','Falafel Wrap','Roasted Beet Salad','Pomegranate Spritz']),

  ('bbbb0003-0000-0000-0000-000000000000',
   'Ember & Soul', ARRAY['Farm-to-Table','Comfort'], ARRAY['Comfort','Happy'],
   'Rustic farm-to-table comfort food with a wood-fire kitchen. Warm interiors, slow-cooked mains, and hearty soups.',
   '19 Hearthstone Ave, Old Quarter', 40.7489, -73.9680, 4.9, 3, '🔥',
   ARRAY['Wood-Fire Veggie Roast','Creamy Lentil Soup','Sourdough & Cultured Butter','Spiced Hot Cider']),

  ('bbbb0004-0000-0000-0000-000000000000',
   'Aura Café', ARRAY['Café','Superfood'], ARRAY['Focus','Energized','Calm'],
   'A minimal, light-filled café specialising in superfood lattes, acai bowls and plant-based bites. Perfect for solo, focused dining.',
   '3 Mindful Place, Arts District', 40.7549, -73.9840, 4.5, 1, '✨',
   ARRAY['Blue Spirulina Latte','Acai Power Bowl','Avocado Toast','Turmeric Oat Milk Latte']),

  ('bbbb0005-0000-0000-0000-000000000000',
   'Roots & Rituals', ARRAY['Ayurvedic','Wellness'], ARRAY['Calm','Comfort','Focus'],
   'An Ayurveda-inspired wellness restaurant curating meals around doshas. Healing broths, adaptogenic drinks, grounding plates.',
   '77 Balance Road, Wellness Quarter', 40.7520, -73.9780, 4.7, 2, '🌱',
   ARRAY['Golden Healing Broth','Ashwagandha Smoothie','Dosha Bowl','Herbal Sleep Tea'])
ON CONFLICT DO NOTHING;

-- ── Sample Posts ──────────────────────────────────────────────
INSERT INTO posts (user_id, post_type, meal_id, note, mood_before, mood_after, like_count, comment_count) VALUES
  ('22222222-2222-2222-2222-222222222222', 'recipe',
   'aaaa0001-0000-0000-0000-000000000000',
   'Made this for a Sunday meal prep and it kept me energised all week! The tahini dressing is everything.',
   NULL, NULL, 142, 28),
  ('33333333-3333-3333-3333-333333333333', 'recipe',
   'aaaa0005-0000-0000-0000-000000000000',
   'My go-to for stressed mornings. Five minutes, no heat, total calm. 🌾',
   NULL, NULL, 89, 15)
ON CONFLICT DO NOTHING;

INSERT INTO posts (user_id, post_type, restaurant_id, note, mood_before, mood_after, like_count, comment_count) VALUES
  ('11111111-1111-1111-1111-111111111111', 'dining',
   'bbbb0001-0000-0000-0000-000000000000',
   'The matcha bowl completely reset my afternoon. So peaceful inside.',
   'Stressed 😓', 'Calm 🌿', 204, 37),
  ('33333333-3333-3333-3333-333333333333', 'dining',
   'bbbb0003-0000-0000-0000-000000000000',
   'Their lentil soup is pure therapy. Felt like home the moment I walked in.',
   'Lonely 💙', 'Warm 🤍', 317, 52)
ON CONFLICT DO NOTHING;

SELECT 'Seed data inserted! ✅' AS status;
