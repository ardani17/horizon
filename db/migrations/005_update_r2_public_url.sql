-- Migration 005: Update R2 public URL from r2.dev to custom domain
-- Replaces all media file_url references from the old pub-*.r2.dev domain
-- to the new custom domain image.cloudnexify.com

UPDATE media
SET file_url = REPLACE(
  file_url,
  'https://pub-93a7943ac95448a79550455d213bc72b.r2.dev',
  'https://image.cloudnexify.com'
)
WHERE file_url LIKE 'https://pub-93a7943ac95448a79550455d213bc72b.r2.dev%';
