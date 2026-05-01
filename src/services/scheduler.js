// src/services/scheduler.js
// Lightweight cron scheduler using setInterval
// No extra dependencies needed — works in Node.js out of the box
// For production: replace with Render.com Cron Jobs (free) or node-cron

const { sendStreakReminders, sendMealReminders } = require('./notification.service');
const { supabaseAdmin } = require('../config/supabase');

const MINUTE = 60 * 1000;
const HOUR   = 60 * MINUTE;

class Scheduler {
  constructor() {
    this.jobs = [];
  }

  start() {
    console.log('⏰ Scheduler started');

    // Check meal reminders every minute
    this._schedule('meal-reminders', MINUTE, sendMealReminders);

    // Check streak reminders at 8pm daily
    this._schedule('streak-check', HOUR, this._streakCheck.bind(this));

    // Hourly: clean up expired refresh tokens
    this._schedule('token-cleanup', HOUR, this._cleanTokens.bind(this));

    // Every 6 hours: update restaurant ratings (when Google Places integrated)
    this._schedule('restaurant-sync', 6 * HOUR, this._syncRestaurants.bind(this));
  }

  _schedule(name, intervalMs, fn) {
    const job = setInterval(async () => {
      try {
        await fn();
      } catch (err) {
        console.error(`❌ Scheduler job "${name}" failed:`, err.message);
      }
    }, intervalMs);
    this.jobs.push({ name, job });
  }

  async _streakCheck() {
    const now = new Date();
    // Only send between 7pm–9pm local time (approximate)
    if (now.getHours() >= 19 && now.getHours() <= 21) {
      await sendStreakReminders();
    }
  }

  async _cleanTokens() {
    const { error } = await supabaseAdmin
      .from('refresh_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());
    if (!error) console.log('🧹 Expired tokens cleaned');
  }

  async _syncRestaurants() {
    // Placeholder: in production, refresh restaurant data from Google Places API
    console.log('🍽️  Restaurant sync tick (no-op until Places API integrated)');
  }

  stop() {
    this.jobs.forEach(({ job }) => clearInterval(job));
    this.jobs = [];
    console.log('⏰ Scheduler stopped');
  }
}

module.exports = new Scheduler();
