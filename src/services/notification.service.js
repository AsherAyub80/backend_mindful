// src/services/notification.service.js
// Firebase Cloud Messaging (FCM) — completely FREE with no limits
// Setup: https://console.firebase.google.com → Project Settings → Cloud Messaging

const { supabaseAdmin } = require('../config/supabase');

// Lazy-load Firebase Admin to avoid crash if FCM_SERVER_KEY not set
let firebaseAdmin = null;
function getFirebase() {
  if (!firebaseAdmin && process.env.FIREBASE_SERVICE_ACCOUNT) {
    const admin = require('firebase-admin');
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  return firebaseAdmin;
}

// ── Store / update FCM token for a user ──────────────────────
async function saveFcmToken(userId, token, deviceInfo = '') {
  await supabaseAdmin.from('fcm_tokens').upsert({
    user_id: userId,
    token,
    device_info: deviceInfo,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token' });
}

// ── Send notification to single user ─────────────────────────
async function sendToUser(userId, { title, body, data = {} }) {
  const fb = getFirebase();
  if (!fb) {
    console.log(`[FCM disabled] Would send to ${userId}: ${title}`);
    return;
  }

  const { data: tokens } = await supabaseAdmin
    .from('fcm_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens?.length) return;

  const messages = tokens.map(({ token }) => ({
    token,
    notification: { title, body },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    android: { priority: 'normal', notification: { sound: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  }));

  for (const msg of messages) {
    try {
      await fb.messaging().send(msg);
    } catch (err) {
      if (err.code === 'messaging/registration-token-not-registered') {
        // Remove stale token
        await supabaseAdmin.from('fcm_tokens').delete().eq('token', msg.token);
      }
    }
  }
}

// ── Streak reminder — call this daily via cron ────────────────
async function sendStreakReminders() {
  // Find users who haven't logged a mood today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: usersWithStreak } = await supabaseAdmin
    .from('users')
    .select('id, name, streak_count')
    .gte('streak_count', 1);

  if (!usersWithStreak) return;

  for (const user of usersWithStreak) {
    const { data: recentLog } = await supabaseAdmin
      .from('mood_logs')
      .select('id')
      .eq('user_id', user.id)
      .gte('logged_at', today.toISOString())
      .limit(1)
      .single();

    if (!recentLog) {
      await sendToUser(user.id, {
        title: `🔥 ${user.streak_count}-day streak at risk!`,
        body: "Log your mood today to keep it alive. What are you feeling? 🌿",
        data: { screen: 'home' },
      });
    }
  }
  console.log(`✅ Streak reminders sent to ${usersWithStreak.length} users`);
}

// ── Meal reminder — personalised to user's set reminder time ─
async function sendMealReminders() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const { data: usersToRemind } = await supabaseAdmin
    .from('user_preferences')
    .select('user_id, meal_reminder_at, users(name)')
    .eq('notifications_on', true)
    .eq('meal_reminder_at', currentTime);

  if (!usersToRemind?.length) return;

  for (const pref of usersToRemind) {
    await sendToUser(pref.user_id, {
      title: `🌿 Time to nourish yourself`,
      body: "How are you feeling? Let's find the perfect meal for your mood.",
      data: { screen: 'home' },
    });
  }
}

// ── Post like notification ────────────────────────────────────
async function notifyPostLiked(postOwnerId, likerName) {
  await sendToUser(postOwnerId, {
    title: `${likerName} liked your post ❤️`,
    body: 'Your mindful moment is inspiring others.',
    data: { screen: 'community' },
  });
}

// ── New follower notification ─────────────────────────────────
async function notifyNewFollower(followedId, followerName) {
  await sendToUser(followedId, {
    title: `${followerName} started following you 🌿`,
    body: 'Your mindful journey is inspiring people.',
    data: { screen: 'profile' },
  });
}

module.exports = {
  saveFcmToken,
  sendToUser,
  sendStreakReminders,
  sendMealReminders,
  notifyPostLiked,
  notifyNewFollower,
};
