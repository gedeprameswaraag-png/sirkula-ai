const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const ApiError = require('../utils/ApiError');

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function uploadPrivateImage(bucket, buffer, mimeType, folder = 'uploads') {
  const ext = EXT_BY_MIME[mimeType] || 'jpg';
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) throw ApiError.unavailable(`Gagal mengunggah foto ke storage: ${error.message}`);
  return data.path;
}

async function removeFile(bucket, path) {
  if (!path) return;
  await supabaseAdmin.storage.from(bucket).remove([path]).catch(() => {});
}

async function getSignedImageUrl(bucket, path, expiresInSeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  return error ? null : data.signedUrl;
}

// Menandatangani banyak foto sekaligus (satu panggilan ke storage). Hasil: Map(path -> url)
async function getSignedImageUrls(bucket, paths, expiresInSeconds = 3600) {
  const unique = [...new Set((paths || []).filter(Boolean))];
  const urlMap = new Map();
  if (!unique.length) return urlMap;

  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrls(unique, expiresInSeconds);
  if (error || !data) return urlMap;

  data.forEach((item) => {
    if (item.signedUrl && item.path) urlMap.set(item.path, item.signedUrl);
  });
  return urlMap;
}

module.exports = { uploadPrivateImage, removeFile, getSignedImageUrl, getSignedImageUrls }; 