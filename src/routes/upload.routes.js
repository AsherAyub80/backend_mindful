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
const storageService = require('../services/storage.service');

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

    const result = await storageService.uploadImage(
      req.file.buffer,
      req.user.id,
      type
    );

    res.json(result);
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

    await storageService.deleteImage(bucket, path);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
