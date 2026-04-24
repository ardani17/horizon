// ============================================
// Horizon Trader Platform — Media Handling Service
// ============================================

import type { S3Client, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

/**
 * Result of a successful media upload to Cloudflare R2.
 */
export interface MediaUploadResult {
  /** Public URL of the uploaded file */
  file_url: string;
  /** R2 object key (path within the bucket) */
  file_key: string;
  /** File size in bytes */
  file_size: number;
}

/**
 * Telegram getFile API response shape.
 */
export interface TelegramFileResponse {
  ok: boolean;
  result?: {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    file_path?: string;
  };
}

/**
 * Abstraction over the Telegram Bot API for downloading files.
 * Injected for testability.
 */
export interface TelegramApiClient {
  /**
   * Call the Telegram getFile API to retrieve file metadata (including file_path).
   */
  getFile(fileId: string): Promise<TelegramFileResponse>;

  /**
   * Download the file bytes from Telegram's file server.
   * @param filePath - The file_path returned by getFile
   * @returns The file content as a Buffer
   */
  downloadFile(filePath: string): Promise<Buffer>;
}

/**
 * Configuration for the MediaService.
 */
export interface MediaServiceConfig {
  /** Cloudflare R2 bucket name */
  bucketName: string;
  /** Public URL prefix for R2 (e.g. https://your-r2-public-url.com) */
  publicUrl: string;
}

/**
 * Logger interface for error logging. Keeps the service decoupled from
 * any specific logging implementation.
 */
export interface MediaLogger {
  error(message: string, context?: Record<string, unknown>): void;
}

/** Default console-based logger */
const defaultLogger: MediaLogger = {
  error(message: string, context?: Record<string, unknown>) {
    console.error('[MediaService]', message, context ?? '');
  },
};

/**
 * Determines the MIME content type from a media type and optional file extension.
 */
function resolveContentType(mediaType: 'image' | 'video', filePath?: string): string {
  const ext = filePath?.split('.').pop()?.toLowerCase();

  if (mediaType === 'image') {
    const imageMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    return imageMap[ext ?? ''] ?? 'image/jpeg';
  }

  const videoMap: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  };
  return videoMap[ext ?? ''] ?? 'video/mp4';
}

/**
 * MediaService handles downloading media from the Telegram Bot API
 * and uploading it to Cloudflare R2 (S3-compatible object storage).
 *
 * Uses dependency injection for the S3 client and Telegram API client
 * to keep the service testable.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 13.10
 */
export class MediaService {
  constructor(
    private readonly s3Client: S3Client,
    private readonly telegramApi: TelegramApiClient,
    private readonly config: MediaServiceConfig,
    private readonly logger: MediaLogger = defaultLogger,
  ) {}

  /**
   * Download a media file from Telegram and upload it to Cloudflare R2.
   *
   * @param fileId - Telegram file_id for the media
   * @param mediaType - Whether the file is an image or video
   * @returns Upload result with file_url, file_key, file_size on success; null on failure
   *
   * Per Requirement 10.4: on any failure (download or upload), the error is
   * logged and null is returned so the caller can continue publishing the
   * article without media.
   */
  async uploadMedia(
    fileId: string,
    mediaType: 'image' | 'video',
  ): Promise<MediaUploadResult | null> {
    try {
      // Step 1: Get file metadata from Telegram (Req 10.1, 10.2)
      const fileResponse = await this.telegramApi.getFile(fileId);

      if (!fileResponse.ok || !fileResponse.result?.file_path) {
        this.logger.error('Telegram getFile failed or returned no file_path', {
          fileId,
          response: fileResponse,
        });
        return null;
      }

      const { file_path, file_size: telegramFileSize } = fileResponse.result;

      // Step 2: Download file bytes from Telegram
      const fileBuffer = await this.telegramApi.downloadFile(file_path);
      const fileSize = fileBuffer.length || telegramFileSize || 0;

      // Step 3: Generate a unique R2 object key
      const ext = file_path.split('.').pop() ?? (mediaType === 'image' ? 'jpg' : 'mp4');
      const fileKey = `${mediaType}/${randomUUID()}.${ext}`;

      // Step 4: Upload to Cloudflare R2 (Req 13.10)
      const contentType = resolveContentType(mediaType, file_path);

      const putParams: PutObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: contentType,
        ContentLength: fileBuffer.length,
      };

      await this.s3Client.send(new PutObjectCommand(putParams));

      // Step 5: Build public URL and return metadata (Req 10.3)
      const publicUrlBase = this.config.publicUrl.replace(/\/+$/, '');
      const fileUrl = `${publicUrlBase}/${fileKey}`;

      return {
        file_url: fileUrl,
        file_key: fileKey,
        file_size: fileSize,
      };
    } catch (error) {
      // Req 10.4: Log error and return null — caller continues without media
      this.logger.error('Media upload failed', {
        fileId,
        mediaType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

/**
 * Factory: create a TelegramApiClient backed by fetch and the bot token.
 */
export function createTelegramApiClient(botToken: string): TelegramApiClient {
  const baseUrl = `https://api.telegram.org/bot${botToken}`;
  const fileBaseUrl = `https://api.telegram.org/file/bot${botToken}`;

  return {
    async getFile(fileId: string): Promise<TelegramFileResponse> {
      const res = await fetch(`${baseUrl}/getFile?file_id=${encodeURIComponent(fileId)}`);
      return res.json() as Promise<TelegramFileResponse>;
    },

    async downloadFile(filePath: string): Promise<Buffer> {
      const res = await fetch(`${fileBaseUrl}/${filePath}`);
      if (!res.ok) {
        throw new Error(`Failed to download file: HTTP ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
  };
}
