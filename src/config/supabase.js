// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

// Public client — respects Row Level Security (use for user-facing queries)
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Admin client — bypasses RLS (use only in secure server-side code)
const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = { supabase, supabaseAdmin };
