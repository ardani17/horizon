import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@shared/db';
import { validateSession } from '@/lib/auth';
import { validateMediaType } from '@shared/utils/mediaValidation';
import { randomUUID } from 'crypto';

/**
 * POST /api/media/upload — Upload media file to Cloudflare R2.
 * Admin-only endpoint.
 *
 * Accepts multipart/form-data with:
 *   - file: the media file (image/* or video/*)
 *   - article_id: (optional) the article to associate the media with
 *
 * Requirements: 6.3, 6.4
 */
export async function POST(request: NextRequest) {
  const admin = await validateSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: { error_code: 'AUTH_REQUIRED', message: 'Autentikasi diperlukan', details: null, timestamp: new Date().toISOString() } },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const articleId = formData.get('article_id') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { error_code: 'VALIDATION_ERROR', message: 'File tidak ditemukan', details: null, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Validate media type (throws MediaTypeInvalidError if invalid)
    try {
      validateMediaType(file.type);
    } catch {
      return NextResponse.json(
        { success: false, error: { error_code: 'MEDIA_TYPE_INVALID', message: `Tipe file "${file.type}" tidak didukung. Hanya file gambar dan video yang diperbolehkan.`, details: { provided: file.type }, timestamp: new Date().toISOString() } },
        { status: 422 },
      );
    }

    // Determine media type
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

    // Generate unique file key
    const ext = file.name.split('.').pop()?.toLowerCase() || (mediaType === 'image' ? 'jpg' : 'mp4');
    const fileKey = `${mediaType}/${randomUUID()}.${ext}`;

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || '',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || '',
      Key: fileKey,
      Body: buffer,
      ContentType: file.type,
      ContentLength: buffer.length,
    }));

    // Build public URL
    const publicUrlBase = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
    const fileUrl = `${publicUrlBase}/${fileKey}`;

    // Save media record in database
    const media = await queryOne<{
      id: string;
      article_id: string | null;
      file_url: string;
      media_type: string;
      file_key: string;
      file_size: number;
      created_at: Date;
    }>(
      `INSERT INTO media (article_id, file_url, media_type, file_key, file_size)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [articleId || null, fileUrl, mediaType, fileKey, buffer.length],
    );

    // Log activity
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, 'admin', 'media_uploaded', 'media', $2, $3)`,
      [admin.id, media?.id, JSON.stringify({ file_key: fileKey, media_type: mediaType, file_size: buffer.length, article_id: articleId })],
    );

    return NextResponse.json({
      success: true,
      data: {
        media: media ? {
          ...media,
          created_at: media.created_at instanceof Date ? media.created_at.toISOString() : String(media.created_at),
        } : null,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: { error_code: 'INTERNAL_ERROR', message: 'Gagal mengunggah media', details: null, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
