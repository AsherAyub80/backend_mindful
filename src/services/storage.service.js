// src/services/storage.service.js
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const config = require('../config');

class StorageService {
  /**
   * Resizes and uploads an image to Supabase Storage
   * @param {Buffer} buffer - Raw image buffer
   * @param {string} userId - ID of the user uploading
   * @param {string} type - 'post' | 'recipe' | 'profile'
   * @returns {Promise<{url: string, path: string, bucket: string}>}
   */
  async uploadImage(buffer, userId, type = 'post') {
    // Resize image with sharp
    const resized = await sharp(buffer)
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
    const fileName = `${userId}/${uuidv4()}.jpg`;

    // Upload to Supabase Storage
    const { error } = await supabaseAdmin.storage
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

    return {
      url: urlData.publicUrl,
      path: fileName,
      bucket,
    };
  }

  /**
   * Deletes an image from Supabase Storage
   * @param {string} bucket - Bucket name
   * @param {string} path - File path
   */
  async deleteImage(bucket, path) {
    const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
    if (error) throw error;
  }
}

module.exports = new StorageService();
