// scripts/create-buckets.js
// Run: node scripts/create-buckets.js
// Creates the required Supabase Storage buckets if they don't exist

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const buckets = [
  { id: 'recipe-images', name: 'recipe-images', public: true },
  { id: 'post-images', name: 'post-images', public: true },
  { id: 'profile-avatars', name: 'profile-avatars', public: true },
];

async function createBuckets() {
  for (const b of buckets) {
    const { data, error } = await supabase.storage.createBucket(b.id, {
      public: b.public,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });

    if (error) {
      if (error.message?.includes('already exists')) {
        console.log(`  ✅ ${b.id} — already exists`);
      } else {
        console.log(`  ❌ ${b.id} — ${error.message}`);
      }
    } else {
      console.log(`  ✅ ${b.id} — created`);
    }
  }
  console.log('\n🎉 Done!');
}

createBuckets();
