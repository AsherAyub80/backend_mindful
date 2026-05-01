// src/services/ai.service.js
//
// ════════════════════════════════════════════════════════════════
//  MindfulMeals AI Service
//
//  HOW IT WORKS:
//  ┌─────────────────────────────────────────────────────────┐
//  │  Node.js (this file)                                    │
//  │    │                                                    │
//  │    ├── tries FastAPI first (port 8000)                  │
//  │    │     • local sentence-transformer embeddings        │
//  │    │     • semantic re-ranking (better results)         │
//  │    │                                                    │
//  │    └── falls back to direct Groq if FastAPI is down     │
//  │          • app still works, just no semantic ranking    │
//  └─────────────────────────────────────────────────────────┘
//
//  Run FastAPI for better AI. Skip it and everything still works.
// ════════════════════════════════════════════════════════════════

const { chatJSON } = require('../config/groq');
const redis        = require('../config/redis');
const config       = require('../config');
const { supabaseAdmin } = require('../config/supabase');

// ─── FastAPI client ───────────────────────────────────────────
// Calls the Python AI service. Returns null if it's not running.
async function callFastAPI(path, body) {
  if (!config.aiService.url) return null;
  try {
    const res = await fetch(`${config.aiService.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': config.aiService.secret || '',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000), // 8s timeout
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // FastAPI not running — silently fall back to Groq
    return null;
  }
}

// ─── 1. MOOD → NUTRITION INTENT ──────────────────────────────
async function getMoodIntent(mood, userPreferences = {}) {
  const cacheKey = `ai:intent:${mood}:${JSON.stringify(userPreferences)}`;
  const cached = await redis.getJSON(cacheKey);
  if (cached) return cached;

  // Try FastAPI first (it also calls Groq internally, same quality)
  const fastApiResult = await callFastAPI('/ai/mood/intent', {
    mood,
    dietary_tags: userPreferences.dietary_tags || [],
    allergy_tags: userPreferences.allergy_tags  || [],
  });
  if (fastApiResult) {
    await redis.setJSON(cacheKey, fastApiResult, 3600);
    return fastApiResult;
  }

  // Fallback: call Groq directly from Node.js
  const messages = [
    {
      role: 'system',
      content: `You are MindfulMeals AI, an expert in nutritional psychology and mindful eating.
Given a user's emotional state, generate structured nutrition guidance.
Respond ONLY with valid JSON:
{
  "intent": "one sentence description of nutritional need",
  "nutrientsFocus": ["nutrient1", "nutrient2"],
  "foodsToEmphasize": ["food1", "food2"],
  "foodsToAvoid": ["food1"],
  "cuisineStyles": ["cuisine1", "cuisine2"],
  "ambienceNeeds": "description of ideal dining environment",
  "mealTone": "calming|energizing|comforting|grounding|celebrating"
}`,
    },
    {
      role: 'user',
      content: `Mood: ${mood}\nDietary restrictions: ${userPreferences.dietary_tags?.join(', ') || 'none'}\nAllergies: ${userPreferences.allergy_tags?.join(', ') || 'none'}`,
    },
  ];

  const intent = await chatJSON(messages);
  await redis.setJSON(cacheKey, intent, 3600);
  return intent;
}

// ─── 2. AI MEAL RECOMMENDATIONS ──────────────────────────────
async function getAIMealRecommendations({ mood, userId, limit = 5 }) {
  const cacheKey = `ai:meals:${mood}:${userId}:${new Date().toDateString()}`;
  const cached = await redis.getJSON(cacheKey);
  if (cached) return cached;

  // Fetch user preferences + candidate meals from Supabase
  const [{ data: prefs }, { data: meals }] = await Promise.all([
    supabaseAdmin.from('user_preferences').select('dietary_tags, allergy_tags, goal_tags, calorie_target').eq('user_id', userId).single(),
    supabaseAdmin.from('meals').select('id, title, description, calories, prep_time_min, mood_tags, dietary_tags, emoji, image_url').contains('mood_tags', [mood]).limit(20),
  ]);

  const candidates = meals || [];
  if (candidates.length === 0) {
    const { data: fallback } = await supabaseAdmin.from('meals').select('id, title, description, calories, prep_time_min, mood_tags, dietary_tags, emoji, image_url').limit(10);
    return buildFallbackRecommendations(fallback || [], mood);
  }

  // Try FastAPI — gives better results via semantic embeddings
  const fastApiResult = await callFastAPI('/ai/meals/recommend', {
    mood,
    candidates: candidates.map(m => ({
      id: m.id, title: m.title, description: m.description || '',
      calories: m.calories || 0, mood_tags: m.mood_tags || [], dietary_tags: m.dietary_tags || [],
    })),
    user_preferences: prefs || {},
    limit,
  });

  if (fastApiResult?.recommendations) {
    const merged = fastApiResult.recommendations
      .map(r => {
        const meal = candidates.find(m => m.id === r.id);
        return meal ? { ...meal, ai_score: r.score, mood_alignment: r.mood_alignment, quick_tip: r.quick_tip } : null;
      })
      .filter(Boolean);

    const result = { recommendations: merged, intent: fastApiResult.intent, mood };
    await redis.setJSON(cacheKey, result, 600);
    return result;
  }

  // Fallback: Groq ranks directly
  const intent = await getMoodIntent(mood, prefs || {});
  const messages = [
    {
      role: 'system',
      content: `Rank these meals for a ${mood} user. Return ONLY JSON array:
[{ "id": "meal-id", "score": 0.95, "mood_alignment": "why", "quick_tip": "tip" }]`,
    },
    {
      role: 'user',
      content: `Mood: ${mood}\nIntent: ${intent.intent}\nFoods to emphasize: ${intent.foodsToEmphasize?.join(', ')}\n\nMeals:\n${JSON.stringify(candidates.map(m => ({ id: m.id, title: m.title, calories: m.calories, description: m.description?.slice(0, 80) })))}`,
    },
  ];

  let rankings;
  try {
    const raw = await chatJSON(messages);
    rankings = Array.isArray(raw) ? raw : raw.rankings || raw.meals || [];
  } catch {
    rankings = candidates.map((m, i) => ({ id: m.id, score: 0.9 - i * 0.05, mood_alignment: `Great for ${mood}`, quick_tip: 'Enjoy mindfully' }));
  }

  const ranked = rankings.slice(0, limit)
    .map(r => { const m = candidates.find(x => x.id === r.id); return m ? { ...m, ai_score: r.score, mood_alignment: r.mood_alignment, quick_tip: r.quick_tip } : null; })
    .filter(Boolean);

  const result = { recommendations: ranked, intent, mood };
  await redis.setJSON(cacheKey, result, 600);
  return result;
}

// ─── 3. RESTAURANT RECOMMENDATIONS ───────────────────────────
async function getAIRestaurantRecommendations({ mood, lat, lng, userId, radiusKm = 2 }) {
  const geoHash   = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`;
  const cacheKey  = `ai:restaurants:${mood}:${geoHash}`;
  const cached    = await redis.getJSON(cacheKey);
  if (cached) return cached;

  // Bounding-box geo filter (works without PostGIS on free Supabase)
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

  const { data: restaurants } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, cuisine_tags, mood_tags, description, address, rating, price_range, emoji, image_url, lat, lng')
    .gte('lat', lat - latDelta).lte('lat', lat + latDelta)
    .gte('lng', lng - lngDelta).lte('lng', lng + lngDelta)
    .eq('is_active', true)
    .limit(15);

  if (!restaurants || restaurants.length === 0) {
    return { recommendations: [], message: 'No restaurants found nearby', mood };
  }

  // Attach real distances
  const withDistance = restaurants
    .map(r => ({ ...r, distance_km: haversine(lat, lng, r.lat, r.lng) }))
    .sort((a, b) => a.distance_km - b.distance_km);

  // Try FastAPI — semantic embedding re-rank (best results)
  const fastApiResult = await callFastAPI('/ai/restaurants/recommend', {
    mood,
    candidates: withDistance.map(r => ({
      id: r.id, name: r.name,
      cuisine_tags: r.cuisine_tags || [], mood_tags: r.mood_tags || [],
      description: r.description || '', rating: r.rating || 0,
      distance_km: r.distance_km,
    })),
    limit: 8,
  });

  if (fastApiResult?.recommendations) {
    const merged = fastApiResult.recommendations
      .map(r => {
        const rest = withDistance.find(x => x.id === r.id);
        return rest ? { ...rest, ai_score: r.score, mood_alignment: r.mood_alignment, matches_mood: r.matches_mood } : null;
      })
      .filter(Boolean);

    const result = { recommendations: merged, intent: fastApiResult.intent, mood };
    await redis.setJSON(cacheKey, result, 900);
    return result;
  }

  // Fallback: Groq ranks directly
  const intent = await getMoodIntent(mood);
  const messages = [
    {
      role: 'system',
      content: `Rank restaurants for a ${mood} user. Return ONLY JSON array:
[{ "id": "id", "score": 0.95, "mood_alignment": "why", "matches_mood": true }]`,
    },
    {
      role: 'user',
      content: `Mood: ${mood}\nNeeds: ${intent.intent}\nAmbience: ${intent.ambienceNeeds}\n\nRestaurants:\n${JSON.stringify(withDistance.slice(0, 10).map(r => ({ id: r.id, name: r.name, cuisine: r.cuisine_tags?.join(', '), mood_tags: r.mood_tags?.join(', '), description: r.description?.slice(0, 80), rating: r.rating, distance: `${r.distance_km.toFixed(1)}km` })))}`,
    },
  ];

  let rankings;
  try {
    rankings = await chatJSON(messages);
    if (!Array.isArray(rankings)) rankings = rankings.restaurants || Object.values(rankings);
  } catch {
    rankings = withDistance.map((r, i) => ({
      id: r.id, score: 0.9 - i * 0.05,
      mood_alignment: `${r.name} suits your ${mood} mood`,
      matches_mood: r.mood_tags?.includes(mood) || false,
    }));
  }

  const ranked = rankings.slice(0, 8)
    .map(r => { const rest = withDistance.find(x => x.id === r.id); return rest ? { ...rest, ai_score: r.score, mood_alignment: r.mood_alignment, matches_mood: r.matches_mood } : null; })
    .filter(Boolean);

  const result = { recommendations: ranked, intent, mood };
  await redis.setJSON(cacheKey, result, 900);
  return result;
}

// ─── 4. MOOD INSIGHTS ────────────────────────────────────────
async function getMoodInsights(userId) {
  const cacheKey = `ai:insights:${userId}:${getWeekKey()}`;
  const cached   = await redis.getJSON(cacheKey);
  if (cached) return cached;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: logs } = await supabaseAdmin
    .from('mood_logs')
    .select('mood, mood_score, context, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false });

  if (!logs || logs.length < 3) {
    return { message: 'Log at least 3 mood entries to see your weekly insights!', hasInsights: false };
  }

  // Try FastAPI first
  const fastApiResult = await callFastAPI('/ai/insights/weekly', { mood_logs: logs });
  if (fastApiResult?.has_insights) {
    await redis.setJSON(cacheKey, fastApiResult, 86400);
    return fastApiResult;
  }

  // Fallback: Groq directly
  const messages = [
    {
      role: 'system',
      content: `You are MindfulMeals AI wellness coach. Analyze mood logs with warmth.
Return ONLY valid JSON:
{
  "summary": "2-3 warm sentences about the week",
  "dominantMood": "most common mood",
  "moodTrend": "improving|declining|stable",
  "insight": "one key observation",
  "recommendation": "one actionable tip",
  "affirmation": "a short encouraging sentence",
  "hasInsights": true,
  "logCount": ${logs.length}
}`,
    },
    { role: 'user', content: `Mood logs:\n${JSON.stringify(logs)}` },
  ];

  const insights = await chatJSON(messages);
  await redis.setJSON(cacheKey, insights, 86400);
  return insights;
}

// ─── 5. SMART MEAL SEARCH ────────────────────────────────────
async function smartMealSearch(query, userId) {
  // Try FastAPI semantic search first (much better results)
  const { data: allMeals } = await supabaseAdmin
    .from('meals')
    .select('id, title, description, calories, prep_time_min, mood_tags, dietary_tags, emoji, image_url')
    .limit(50);

  const fastApiResult = await callFastAPI('/ai/meals/search', {
    query,
    candidates: (allMeals || []).map(m => ({
      id: m.id, title: m.title, description: m.description || '',
      calories: m.calories || 0, mood_tags: m.mood_tags || [], dietary_tags: m.dietary_tags || [],
    })),
    top_k: 8,
  });

  if (fastApiResult?.results) {
    const ids = fastApiResult.results.map(r => r.id);
    const meals = (allMeals || []).filter(m => ids.includes(m.id))
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return { meals, filters: fastApiResult.extracted_filters || {} };
  }

  // Fallback: Groq extracts filters, Supabase queries
  const messages = [
    {
      role: 'system',
      content: `Extract search filters from a natural language query.
Return ONLY valid JSON:
{ "mood": "Calm|Energized|Comfort|Focus|Happy|null", "maxCalories": 500, "dietary": ["vegan"], "keywords": ["keyword"] }`,
    },
    { role: 'user', content: `Query: "${query}"` },
  ];

  const filters = await chatJSON(messages);

  let qb = supabaseAdmin.from('meals').select('id, title, description, calories, prep_time_min, mood_tags, dietary_tags, emoji, image_url');
  if (filters.mood)          qb = qb.contains('mood_tags', [filters.mood]);
  if (filters.maxCalories)   qb = qb.lte('calories', filters.maxCalories);
  if (filters.dietary?.length) qb = qb.overlaps('dietary_tags', filters.dietary);

  const { data: meals } = await qb.limit(10);
  return { meals: meals || [], filters };
}

// ─── Helpers ──────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
             * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getWeekKey() {
  const d   = new Date();
  const soy = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-W${Math.ceil(((d - soy) / 86400000 + soy.getDay() + 1) / 7)}`;
}

function buildFallbackRecommendations(meals, mood) {
  return {
    recommendations: meals.slice(0, 5).map((m, i) => ({
      ...m, ai_score: 0.8 - i * 0.05,
      mood_alignment: `A great choice for your ${mood} mood`,
      quick_tip: 'Take a moment to eat mindfully',
    })),
    intent: { intent: `Nourishing meals for your ${mood} state`, mealTone: mood.toLowerCase() },
    mood,
  };
}

module.exports = {
  getMoodIntent,
  getAIMealRecommendations,
  getAIRestaurantRecommendations,
  getMoodInsights,
  smartMealSearch,
};
