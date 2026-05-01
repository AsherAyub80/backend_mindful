// src/routes/upload.routes.js
//
// Uses Supabase Storage — FREE 1GB included in free plan
// No AWS needed at all!
//
const router = require('express').Router();
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const config = require('../config');

// Store in memory (max 10MB), then upload to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// POST /v1/uploads/image — upload single image
router.post('/image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const { type = 'post' } = req.query; // 'post' | 'recipe' | 'profile'

    // Resize image with sharp
    const resized = await sharp(req.file.buffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Choose bucket
    const bucketMap = {
      post: config.storage.bucketPosts,
      recipe: config.storage.bucketRecipes,
      profile: config.storage.bucketProfiles,
    };
    const bucket = bucketMap[type] || config.storage.bucketPosts;
    const fileName = `${req.user.id}/${uuidv4()}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, resized, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // 1 year cache
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(fileName);

    res.json({
      url: urlData.publicUrl,
      path: fileName,
      bucket,
    });
  } catch (err) { next(err); }
});

// DELETE /v1/uploads/image — delete an image
router.delete('/image', requireAuth, async (req, res, next) => {
  try {
    const { bucket, path } = req.body;
    if (!bucket || !path) return res.status(400).json({ error: 'bucket and path required' });

    // Security: only allow deleting own files
    if (!path.startsWith(req.user.id)) {
      return res.status(403).json({ error: 'Cannot delete another user\'s image' });
    }

    await supabaseAdmin.storage.from(bucket).remove([path]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
