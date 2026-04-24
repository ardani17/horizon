// ============================================
// Horizon Trader Platform — Media Service Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MediaService,
  type TelegramApiClient,
  type MediaServiceConfig,
  type MediaLogger,
  type TelegramFileResponse,
} from '../../../bot/src/services/mediaService';
import type { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';

// ---- Test Helpers ----

function createMockS3Client(): S3Client {
  return {
    send: vi.fn().mockResolvedValue({}),
  } as unknown as S3Client;
}

function createMockTelegramApi(overrides: Partial<TelegramApiClient> = {}): TelegramApiClient {
  return {
    getFile: vi.fn().mockResolvedValue({
      ok: true,
      result: {
        file_id: 'test-file-id',
        file_unique_id: 'test-unique-id',
        file_size: 12345,
        file_path: 'photos/file_0.jpg',
      },
    } satisfies TelegramFileResponse),
    downloadFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    ...overrides,
  };
}

function createMockConfig(): MediaServiceConfig {
  return {
    bucketName: 'horizon-media',
    publicUrl: 'https://r2.example.com',
  };
}

function createMockLogger(): MediaLogger {
  return {
    error: vi.fn(),
  };
}

// ---- Tests ----

describe('MediaService', () => {
  let s3Client: S3Client;
  let telegramApi: TelegramApiClient;
  let config: MediaServiceConfig;
  let logger: MediaLogger;
  let service: MediaService;

  beforeEach(() => {
    s3Client = createMockS3Client();
    telegramApi = createMockTelegramApi();
    config = createMockConfig();
    logger = createMockLogger();
    service = new MediaService(s3Client, telegramApi, config, logger);
  });

  describe('uploadMedia — successful image upload (Req 10.1, 10.3)', () => {
    it('should call Telegram getFile with the provided fileId', async () => {
      await service.uploadMedia('photo-file-id', 'image');

      expect(telegramApi.getFile).toHaveBeenCalledWith('photo-file-id');
    });

    it('should download the file using the file_path from getFile', async () => {
      await service.uploadMedia('photo-file-id', 'image');

      expect(telegramApi.downloadFile).toHaveBeenCalledWith('photos/file_0.jpg');
    });

    it('should upload the file to S3/R2 with correct parameters', async () => {
      await service.uploadMedia('photo-file-id', 'image');

      const sendMock = vi.mocked(s3Client.send);
      expect(sendMock).toHaveBeenCalledTimes(1);

      const command = sendMock.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.Bucket).toBe('horizon-media');
      expect(command.input.Key).toMatch(/^image\/[a-f0-9-]+\.jpg$/);
      expect(command.input.ContentType).toBe('image/jpeg');
      expect(command.input.Body).toEqual(Buffer.from('fake-image-data'));
    });

    it('should return file_url, file_key, and file_size on success', async () => {
      const result = await service.uploadMedia('photo-file-id', 'image');

      expect(result).not.toBeNull();
      expect(result!.file_url).toMatch(/^https:\/\/r2\.example\.com\/image\/[a-f0-9-]+\.jpg$/);
      expect(result!.file_key).toMatch(/^image\/[a-f0-9-]+\.jpg$/);
      expect(result!.file_size).toBeGreaterThan(0);
    });
  });

  describe('uploadMedia — successful video upload (Req 10.2, 10.3)', () => {
    beforeEach(() => {
      telegramApi = createMockTelegramApi({
        getFile: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            file_id: 'video-file-id',
            file_unique_id: 'video-unique-id',
            file_size: 99999,
            file_path: 'videos/file_1.mp4',
          },
        } satisfies TelegramFileResponse),
        downloadFile: vi.fn().mockResolvedValue(Buffer.from('fake-video-data')),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);
    });

    it('should upload video with correct content type', async () => {
      await service.uploadMedia('video-file-id', 'video');

      const sendMock = vi.mocked(s3Client.send);
      const command = sendMock.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.Key).toMatch(/^video\/[a-f0-9-]+\.mp4$/);
      expect(command.input.ContentType).toBe('video/mp4');
    });

    it('should return video metadata on success', async () => {
      const result = await service.uploadMedia('video-file-id', 'video');

      expect(result).not.toBeNull();
      expect(result!.file_url).toMatch(/^https:\/\/r2\.example\.com\/video\/[a-f0-9-]+\.mp4$/);
      expect(result!.file_key).toMatch(/^video\/[a-f0-9-]+\.mp4$/);
      expect(result!.file_size).toBeGreaterThan(0);
    });
  });

  describe('uploadMedia — graceful failure handling (Req 10.4)', () => {
    it('should return null when Telegram getFile returns ok: false', async () => {
      telegramApi = createMockTelegramApi({
        getFile: vi.fn().mockResolvedValue({ ok: false }),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);

      const result = await service.uploadMedia('bad-file-id', 'image');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Telegram getFile failed or returned no file_path',
        expect.objectContaining({ fileId: 'bad-file-id' }),
      );
    });

    it('should return null when Telegram getFile returns no file_path', async () => {
      telegramApi = createMockTelegramApi({
        getFile: vi.fn().mockResolvedValue({
          ok: true,
          result: { file_id: 'x', file_unique_id: 'y' },
        }),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);

      const result = await service.uploadMedia('no-path-file', 'image');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return null when Telegram download fails', async () => {
      telegramApi = createMockTelegramApi({
        downloadFile: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);

      const result = await service.uploadMedia('file-id', 'image');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Media upload failed',
        expect.objectContaining({
          fileId: 'file-id',
          error: 'Network error',
        }),
      );
    });

    it('should return null when S3 upload fails', async () => {
      s3Client = {
        send: vi.fn().mockRejectedValue(new Error('S3 timeout')),
      } as unknown as S3Client;
      service = new MediaService(s3Client, telegramApi, config, logger);

      const result = await service.uploadMedia('file-id', 'image');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Media upload failed',
        expect.objectContaining({
          error: 'S3 timeout',
        }),
      );
    });

    it('should not throw when upload fails — caller can continue', async () => {
      s3Client = {
        send: vi.fn().mockRejectedValue(new Error('Boom')),
      } as unknown as S3Client;
      service = new MediaService(s3Client, telegramApi, config, logger);

      // Should not throw
      await expect(service.uploadMedia('file-id', 'video')).resolves.toBeNull();
    });
  });

  describe('file key generation', () => {
    it('should generate unique file keys for each upload', async () => {
      const result1 = await service.uploadMedia('file-1', 'image');
      const result2 = await service.uploadMedia('file-2', 'image');

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1!.file_key).not.toBe(result2!.file_key);
    });

    it('should prefix image keys with "image/"', async () => {
      const result = await service.uploadMedia('file-id', 'image');

      expect(result!.file_key).toMatch(/^image\//);
    });

    it('should prefix video keys with "video/"', async () => {
      telegramApi = createMockTelegramApi({
        getFile: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            file_id: 'vid',
            file_unique_id: 'vu',
            file_size: 5000,
            file_path: 'videos/clip.mp4',
          },
        }),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);

      const result = await service.uploadMedia('vid', 'video');

      expect(result!.file_key).toMatch(/^video\//);
    });
  });

  describe('content type resolution', () => {
    it('should resolve .png to image/png', async () => {
      telegramApi = createMockTelegramApi({
        getFile: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            file_id: 'png-file',
            file_unique_id: 'pu',
            file_size: 8000,
            file_path: 'photos/image.png',
          },
        }),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);

      await service.uploadMedia('png-file', 'image');

      const sendMock = vi.mocked(s3Client.send);
      const command = sendMock.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.ContentType).toBe('image/png');
    });

    it('should resolve .webm to video/webm', async () => {
      telegramApi = createMockTelegramApi({
        getFile: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            file_id: 'webm-file',
            file_unique_id: 'wu',
            file_size: 20000,
            file_path: 'videos/clip.webm',
          },
        }),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);

      await service.uploadMedia('webm-file', 'video');

      const sendMock = vi.mocked(s3Client.send);
      const command = sendMock.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.ContentType).toBe('video/webm');
    });

    it('should default to image/jpeg for unknown image extensions', async () => {
      telegramApi = createMockTelegramApi({
        getFile: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            file_id: 'unknown-img',
            file_unique_id: 'ui',
            file_size: 3000,
            file_path: 'photos/image.bmp',
          },
        }),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);

      await service.uploadMedia('unknown-img', 'image');

      const sendMock = vi.mocked(s3Client.send);
      const command = sendMock.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.ContentType).toBe('image/jpeg');
    });
  });

  describe('public URL construction', () => {
    it('should strip trailing slashes from publicUrl', async () => {
      config.publicUrl = 'https://r2.example.com/';
      service = new MediaService(s3Client, telegramApi, config, logger);

      const result = await service.uploadMedia('file-id', 'image');

      expect(result!.file_url).not.toContain('//image');
      expect(result!.file_url).toMatch(/^https:\/\/r2\.example\.com\/image\//);
    });

    it('should handle publicUrl without trailing slash', async () => {
      config.publicUrl = 'https://cdn.example.com';
      service = new MediaService(s3Client, telegramApi, config, logger);

      const result = await service.uploadMedia('file-id', 'image');

      expect(result!.file_url).toMatch(/^https:\/\/cdn\.example\.com\/image\//);
    });
  });

  describe('file size tracking', () => {
    it('should use buffer length as file_size', async () => {
      const fileData = Buffer.alloc(54321, 'x');
      telegramApi = createMockTelegramApi({
        downloadFile: vi.fn().mockResolvedValue(fileData),
      });
      service = new MediaService(s3Client, telegramApi, config, logger);

      const result = await service.uploadMedia('file-id', 'image');

      expect(result!.file_size).toBe(54321);
    });
  });
});
