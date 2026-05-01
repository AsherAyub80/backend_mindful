// src/config/index.js
require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    fastModel: process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant',
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  storage: {
    bucketRecipes: process.env.STORAGE_BUCKET_RECIPES || 'recipe-images',
    bucketProfiles: process.env.STORAGE_BUCKET_PROFILES || 'profile-avatars',
    bucketPosts: process.env.STORAGE_BUCKET_POSTS || 'post-images',
  },

  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    secret: process.env.AI_SERVICE_SECRET,
  },
};

// Validate required vars
const required = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GROQ_API_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required env vars:', missing.join(', '));
  process.exit(1);
}

module.exports = config;
