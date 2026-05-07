# 🌿 MindfulMeals — Phase 3 Setup Guide
# All Free Tier — Zero Cost to Start

## ─────────────────────────────────────────────────────
## FREE SERVICES USED & WHERE TO GET THEM
## ─────────────────────────────────────────────────────

| Service      | What For              | Free Limit              | Sign Up                        |
|-------------|----------------------|-------------------------|-------------------------------|
| Supabase    | PostgreSQL + Storage  | 500MB DB, 1GB storage   | https://supabase.com          |
| Groq        | AI (Llama 3.3 70B)   | 14,400 req/day          | https://console.groq.com      |
| Upstash     | Redis cache           | 10,000 cmd/day          | https://upstash.com           |
| Render.com  | Host Node.js API      | 750 hrs/month           | https://render.com            |
| Firebase    | Push notifications    | Unlimited FCM           | https://console.firebase.google.com |

---

## STEP 1 — Supabase Setup (Database + Storage)

1. Go to https://supabase.com → New Project
2. Note your Project URL and API keys (Settings → API)
3. Go to SQL Editor → paste and run migrations/001_init.sql
4. Go to SQL Editor → paste and run migrations/002_seed.sql
5. Go to SQL Editor → paste and run migrations/003_analytics.sql
6. Go to Storage → Create 3 buckets (make all PUBLIC):
   - recipe-images
   - profile-avatars
   - post-images

## STEP 2 — Groq API Key

1. Go to https://console.groq.com
2. Sign up (free) → API Keys → Create new key
3. Copy key starting with "gsk_..."
4. Free tier: 14,400 requests/day, 500k tokens/day
   Model used: llama-3.3-70b-versatile (GPT-4 quality, completely free)

## STEP 3 — Upstash Redis

1. Go to https://upstash.com → Create account
2. Create Database → Select region closest to you
3. Copy Redis URL (starts with rediss://)
4. Free tier: 10,000 commands/day, 256MB

## STEP 4 — Environment Variables

cp .env.example .env
# Fill in all values:
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# GROQ_API_KEY
# REDIS_URL
# JWT_SECRET (generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

---

## RUNNING LOCALLY

### Option A — Docker Compose (recommended, everything at once)
docker-compose up --build

### Option B — Manual

# Terminal 1: Start API
cd mindfulmeals_backend
npm install
npm run dev

# Terminal 2: Start AI Service
cd mindfulmeals_backend/ai_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

### Verify everything works:
curl http://localhost:3000/health
curl http://localhost:8000/health

### API documentation
Once the backend is running, open:
- Swagger UI: http://localhost:3000/api-docs
- Shortcut redirect: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/api-docs.json

For protected routes, click `Authorize` in Swagger UI and paste your JWT access token as `Bearer <token>`.

---

## FLUTTER INTEGRATION

# In your Phase 1+2 Flutter project:

# 1. Add dependencies to pubspec.yaml (copy from mindfulmeals_flutter_integration/pubspec.yaml)
flutter pub add flutter_riverpod http shared_preferences geolocator

# 2. Copy these files into your lib/ folder:
#    services/api_service.dart     — HTTP client + all API calls
#    providers/app_providers.dart  — Riverpod state management
#    screens/auth/login_screen.dart
#    screens/profile_screen_live.dart
#    screens/community_screen_live.dart

# 3. Wrap your app in ProviderScope (in main.dart):
#    runApp(ProviderScope(child: MindfulMealsApp()))

# 4. Replace MainShell nav destinations with live screens:
#    Profile  → ProfileScreenLive()
#    Community → CommunityScreenLive()

# 5. Change API_BASE_URL to your Render.com URL for production

---

## DEPLOYING TO RENDER.COM (free hosting)

1. Push your code to GitHub
2. Go to render.com → New Web Service → Connect GitHub repo
3. Settings:
   - Build Command:  npm install
   - Start Command:  node src/server.js
   - Environment:    Node 20
4. Add all .env variables in Render dashboard (Environment tab)
5. Deploy — Render gives you: https://your-app.onrender.com

Note: Free tier sleeps after 15min of inactivity (first request ~30s cold start)
Upgrade to $7/month Starter plan to keep it always awake.

### Deploying AI Service:
Same steps but:
- Build Command: pip install -r requirements.txt
- Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
- Add GROQ_API_KEY and AI_SERVICE_SECRET env vars

---

## PHASE 3 FILE STRUCTURE

mindfulmeals_backend/
├── src/
│   ├── server.js              ← Entry point + scheduler boot
│   ├── app.js                 ← Express + routes
│   ├── config/
│   │   ├── index.js           ← Config + env validation
│   │   ├── supabase.js        ← Supabase client (public + admin)
│   │   ├── redis.js           ← Upstash Redis client
│   │   └── groq.js            ← Groq AI client
│   ├── middleware/
│   │   ├── auth.js            ← JWT verify middleware
│   │   ├── rateLimit.js       ← Redis sliding window limiter
│   │   └── errorHandler.js    ← Global error → JSON
│   ├── routes/
│   │   ├── auth.routes.js     ← Register, login, refresh, logout
│   │   ├── user.routes.js     ← Profile, preferences, follow
│   │   ├── mood.routes.js     ← Log mood, history, AI insights
│   │   ├── meal.routes.js     ← List, detail, AI suggest, save
│   │   ├── restaurant.routes.js ← Nearby (geo), detail, experiences
│   │   ├── post.routes.js     ← Feed, create, like, comment
│   │   └── upload.routes.js   ← Supabase Storage image upload
│   └── services/
│       ├── ai.service.js      ← ALL AI logic (Groq + caching)
│       ├── notification.service.js ← FCM push notifications
│       └── scheduler.js       ← Cron jobs (streaks, cleanup)
├── ai_service/                ← FastAPI Python microservice
│   ├── main.py                ← FastAPI app
│   ├── routers/
│   │   ├── mood.py            ← /ai/mood/intent
│   │   ├── meals.py           ← /ai/meals/recommend + /embed + /search
│   │   ├── restaurants.py     ← /ai/restaurants/recommend
│   │   └── insights.py        ← /ai/insights/weekly
│   ├── services/
│   │   ├── embeddings.py      ← LOCAL sentence-transformers (FREE)
│   │   └── groq_client.py     ← Async Groq wrapper
│   └── models/schemas.py      ← Pydantic request/response models
├── migrations/
│   ├── 001_init.sql           ← All tables, indexes, RLS, functions
│   ├── 002_seed.sql           ← 10 meals, 5 restaurants, 3 users
│   └── 003_analytics.sql      ← Views, FCM tokens, analytics
├── docker-compose.yml         ← Run all services locally
├── Dockerfile.api             ← Node.js container
└── ai_service/Dockerfile.ai   ← Python + pre-downloaded model

mindfulmeals_flutter_integration/
├── lib/
│   ├── main.dart              ← ProviderScope + AuthGate
│   ├── services/api_service.dart      ← All API calls + models
│   ├── providers/app_providers.dart   ← Auth, Mood, Feed, AI providers
│   └── screens/
│       ├── auth/login_screen.dart
│       ├── profile_screen_live.dart
│       └── community_screen_live.dart
└── pubspec.yaml               ← Phase 3 dependencies

---

## WHY FASTAPI (Python) — SIMPLE EXPLANATION

Imagine your app is a restaurant kitchen:

  Node.js  = The head chef. Takes all orders, manages the whole kitchen.
  FastAPI  = The specialist pastry station. Only does desserts (AI stuff).

Node.js can't run sentence-transformers or numpy.
Python can. So Python runs a tiny web server (FastAPI) that:
  1. Loads the AI model once (22MB, runs on CPU)
  2. Waits for Node.js to call it: "rank these meals for Calm mood"
  3. Does the AI work (embeddings + semantic search)
  4. Returns the ranked results

Without Python: you'd pay OpenAI for every embedding query.
With Python (sentence-transformers): embeddings are FREE, instant, local.

You ONLY need FastAPI for:
  ✅ Local embeddings (sentence-transformers)
  ✅ Future: custom ML models or LangChain pipelines

The Groq AI calls can stay in Node.js (ai.service.js already does this).
FastAPI is optional to start — run just Node.js for Phase 3 MVP.

---

## TOTAL MONTHLY COST TO RUN

| Service     | Free Limit    | When You'd Pay     | Paid Price    |
|------------|--------------|-------------------|---------------|
| Supabase   | 500MB / 1GB  | > 500MB data       | $25/month     |
| Groq       | 14,400/day   | > 14,400 AI calls  | Pay-per-token |
| Upstash    | 10,000/day   | > 10,000 Redis ops | $0.20/100k    |
| Render.com | 750 hrs      | Always-on needed   | $7/month      |
| Firebase   | Unlimited    | Never (FCM is free) | $0           |

TOTAL FOR MVP/TESTING: $0/month
TOTAL FOR SMALL PRODUCTION (< 1000 users): ~$7/month (just Render)
