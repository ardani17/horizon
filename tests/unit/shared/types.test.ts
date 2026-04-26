import { describe, it, expect } from 'vitest';
import {
  ArticleCategory,
  UserRole,
  ArticleStatus,
  ArticleSource,
  TransactionType,
  SourceType,
  MediaType,
  ActorType,
  TargetType,
  CommentStatus,
  ErrorCode,
  ERROR_CODE_TO_HTTP_STATUS,
} from '../../../shared/types/index';
import type {
  User,
  Article,
  Media,
  CreditTransaction,
  CreditSettings,
  ActivityLog,
  Comment,
  Like,
  ApiKey,
  AdminSession,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
} from '../../../shared/types/index';

describe('Shared Types — Enums and Constants', () => {
  it('ArticleCategory has all expected values', () => {
    expect(ArticleCategory.TRADING).toBe('trading');
    expect(ArticleCategory.LIFE_STORY).toBe('life_story');
    expect(ArticleCategory.GENERAL).toBe('general');
    expect(ArticleCategory.OUTLOOK).toBe('outlook');
    expect(Object.keys(ArticleCategory)).toHaveLength(4);
  });

  it('UserRole has member and admin', () => {
    expect(UserRole.MEMBER).toBe('member');
    expect(UserRole.ADMIN).toBe('admin');
    expect(Object.keys(UserRole)).toHaveLength(2);
  });

  it('ArticleStatus has all expected values', () => {
    expect(ArticleStatus.PUBLISHED).toBe('published');
    expect(ArticleStatus.HIDDEN).toBe('hidden');
    expect(ArticleStatus.DRAFT).toBe('draft');
    expect(Object.keys(ArticleStatus)).toHaveLength(3);
  });

  it('ArticleSource has telegram and dashboard', () => {
    expect(ArticleSource.TELEGRAM).toBe('telegram');
    expect(ArticleSource.DASHBOARD).toBe('dashboard');
    expect(Object.keys(ArticleSource)).toHaveLength(2);
  });

  it('TransactionType has earned, spent, adjusted', () => {
    expect(TransactionType.EARNED).toBe('earned');
    expect(TransactionType.SPENT).toBe('spent');
    expect(TransactionType.ADJUSTED).toBe('adjusted');
    expect(Object.keys(TransactionType)).toHaveLength(3);
  });

  it('SourceType has all expected values', () => {
    expect(SourceType.ARTICLE_TRADING).toBe('article_trading');
    expect(SourceType.ARTICLE_LIFE_STORY).toBe('article_life_story');
    expect(SourceType.ARTICLE_GENERAL).toBe('article_general');
    expect(SourceType.MANUAL_ADMIN).toBe('manual_admin');
    expect(SourceType.EXTERNAL_TOOL).toBe('external_tool');
    expect(Object.keys(SourceType)).toHaveLength(5);
  });

  it('MediaType has image and video', () => {
    expect(MediaType.IMAGE).toBe('image');
    expect(MediaType.VIDEO).toBe('video');
    expect(Object.keys(MediaType)).toHaveLength(2);
  });

  it('ActorType has all expected values', () => {
    expect(ActorType.ADMIN).toBe('admin');
    expect(ActorType.MEMBER).toBe('member');
    expect(ActorType.SYSTEM).toBe('system');
    expect(ActorType.EXTERNAL_API).toBe('external_api');
    expect(Object.keys(ActorType)).toHaveLength(4);
  });

  it('TargetType has all expected values', () => {
    expect(TargetType.ARTICLE).toBe('article');
    expect(TargetType.MEDIA).toBe('media');
    expect(TargetType.USER).toBe('user');
    expect(TargetType.CREDIT).toBe('credit');
    expect(TargetType.SETTING).toBe('setting');
    expect(TargetType.API_KEY).toBe('api_key');
    expect(Object.keys(TargetType)).toHaveLength(6);
  });

  it('CommentStatus has visible and hidden', () => {
    expect(CommentStatus.VISIBLE).toBe('visible');
    expect(CommentStatus.HIDDEN).toBe('hidden');
    expect(Object.keys(CommentStatus)).toHaveLength(2);
  });
});

describe('Shared Types — Error Code Registry', () => {
  it('ErrorCode has all expected codes', () => {
    expect(ErrorCode.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
    expect(ErrorCode.AUTH_INVALID).toBe('AUTH_INVALID');
    expect(ErrorCode.AUTH_FORBIDDEN).toBe('AUTH_FORBIDDEN');
    expect(ErrorCode.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.CREDIT_INSUFFICIENT).toBe('CREDIT_INSUFFICIENT');
    expect(ErrorCode.MEDIA_TYPE_INVALID).toBe('MEDIA_TYPE_INVALID');
    expect(ErrorCode.MEDIA_SIZE_EXCEEDED).toBe('MEDIA_SIZE_EXCEEDED');
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(Object.keys(ErrorCode)).toHaveLength(10);
  });

  it('ERROR_CODE_TO_HTTP_STATUS maps every error code to correct HTTP status', () => {
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.AUTH_REQUIRED]).toBe(401);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.AUTH_INVALID]).toBe(401);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.AUTH_FORBIDDEN]).toBe(403);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.RESOURCE_NOT_FOUND]).toBe(404);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.VALIDATION_ERROR]).toBe(422);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.CREDIT_INSUFFICIENT]).toBe(422);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.MEDIA_TYPE_INVALID]).toBe(422);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.MEDIA_SIZE_EXCEEDED]).toBe(422);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.RATE_LIMIT_EXCEEDED]).toBe(429);
    expect(ERROR_CODE_TO_HTTP_STATUS[ErrorCode.INTERNAL_ERROR]).toBe(500);
  });

  it('every ErrorCode has a corresponding HTTP status mapping', () => {
    const errorCodes = Object.values(ErrorCode);
    const mappedCodes = Object.keys(ERROR_CODE_TO_HTTP_STATUS);
    expect(mappedCodes).toHaveLength(errorCodes.length);
    for (const code of errorCodes) {
      expect(ERROR_CODE_TO_HTTP_STATUS[code]).toBeDefined();
    }
  });
});

describe('Shared Types — Entity Interface Shapes', () => {
  it('User interface matches database schema', () => {
    const user: User = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      telegram_id: 123456789,
      username: 'trader1',
      password_hash: null,
      role: UserRole.MEMBER,
      credit_balance: 0,
      created_at: new Date(),
    };
    expect(user.id).toBeDefined();
    expect(user.role).toBe('member');
    expect(user.credit_balance).toBe(0);
  });

  it('Article interface matches database schema', () => {
    const article: Article = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      author_id: '550e8400-e29b-41d4-a716-446655440000',
      content_html: '<p>Hello</p>',
      title: 'Test Article',
      category: ArticleCategory.TRADING,
      source: ArticleSource.TELEGRAM,
      status: ArticleStatus.PUBLISHED,
      slug: 'test-article-abc123',
      created_at: new Date(),
    };
    expect(article.category).toBe('trading');
    expect(article.source).toBe('telegram');
    expect(article.status).toBe('published');
  });

  it('Media interface matches database schema', () => {
    const media: Media = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      article_id: '550e8400-e29b-41d4-a716-446655440001',
      file_url: 'https://r2.example.com/media/photo.jpg',
      media_type: MediaType.IMAGE,
      file_key: 'media/photo.jpg',
      file_size: 1024000,
      created_at: new Date(),
    };
    expect(media.media_type).toBe('image');
    expect(media.file_size).toBe(1024000);
  });

  it('CreditTransaction interface matches database schema', () => {
    const tx: CreditTransaction = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 10,
      transaction_type: TransactionType.EARNED,
      source_type: SourceType.ARTICLE_TRADING,
      source_id: '550e8400-e29b-41d4-a716-446655440001',
      description: null,
      created_at: new Date(),
    };
    expect(tx.transaction_type).toBe('earned');
    expect(tx.source_type).toBe('article_trading');
  });

  it('CreditSettings interface matches database schema', () => {
    const settings: CreditSettings = {
      id: '550e8400-e29b-41d4-a716-446655440004',
      category: ArticleCategory.TRADING,
      credit_reward: 10,
      is_active: true,
      updated_at: new Date(),
    };
    expect(settings.credit_reward).toBe(10);
    expect(settings.is_active).toBe(true);
  });

  it('ActivityLog interface matches database schema', () => {
    const log: ActivityLog = {
      id: '550e8400-e29b-41d4-a716-446655440005',
      actor_id: '550e8400-e29b-41d4-a716-446655440000',
      actor_type: ActorType.MEMBER,
      action: 'article_created',
      target_type: TargetType.ARTICLE,
      target_id: '550e8400-e29b-41d4-a716-446655440001',
      details: { before: null, after: { status: 'published' } },
      ip_address: null,
      created_at: new Date(),
    };
    expect(log.actor_type).toBe('member');
    expect(log.target_type).toBe('article');
  });

  it('Comment interface matches database schema', () => {
    const comment: Comment = {
      id: '550e8400-e29b-41d4-a716-446655440006',
      article_id: '550e8400-e29b-41d4-a716-446655440001',
      user_id: null,
      display_name: 'Anonim',
      content: 'Great article!',
      is_anonymous: true,
      status: CommentStatus.VISIBLE,
      created_at: new Date(),
    };
    expect(comment.display_name).toBe('Anonim');
    expect(comment.is_anonymous).toBe(true);
  });

  it('Like interface matches database schema', () => {
    const like: Like = {
      id: '550e8400-e29b-41d4-a716-446655440007',
      article_id: '550e8400-e29b-41d4-a716-446655440001',
      fingerprint: 'abc123def456',
      created_at: new Date(),
    };
    expect(like.fingerprint).toBe('abc123def456');
  });

  it('ApiKey interface matches database schema', () => {
    const apiKey: ApiKey = {
      id: '550e8400-e29b-41d4-a716-446655440008',
      key_hash: '$2b$10$hashedvalue',
      key_prefix: 'hzn_1234',
      app_name: 'Trading Tool',
      created_by: '550e8400-e29b-41d4-a716-446655440000',
      allowed_origins: 'https://tool.example.com',
      is_active: true,
      last_used_at: null,
      created_at: new Date(),
    };
    expect(apiKey.key_prefix).toBe('hzn_1234');
    expect(apiKey.is_active).toBe(true);
  });

  it('AdminSession interface matches database schema', () => {
    const session: AdminSession = {
      id: '550e8400-e29b-41d4-a716-446655440009',
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      token_hash: 'hashed_token_value',
      expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
    };
    expect(session.token_hash).toBe('hashed_token_value');
    expect(session.expires_at.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('Shared Types — API Response Types', () => {
  it('ApiSuccessResponse wraps data correctly', () => {
    const response: ApiSuccessResponse<{ balance: number }> = {
      success: true,
      data: { balance: 45 },
    };
    expect(response.success).toBe(true);
    expect(response.data.balance).toBe(45);
  });

  it('ApiErrorResponse wraps error correctly', () => {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        error_code: ErrorCode.CREDIT_INSUFFICIENT,
        message: 'Saldo credit tidak mencukupi',
        details: { current_balance: 5, requested_amount: 10 },
        timestamp: new Date().toISOString(),
      },
    };
    expect(response.success).toBe(false);
    expect(response.error.error_code).toBe('CREDIT_INSUFFICIENT');
    expect(response.error.details).not.toBeNull();
  });

  it('ApiResponse union type works for success', () => {
    const response: ApiResponse<string> = {
      success: true,
      data: 'ok',
    };
    if (response.success) {
      expect(response.data).toBe('ok');
    }
  });

  it('ApiResponse union type works for error', () => {
    const response: ApiResponse<string> = {
      success: false,
      error: {
        error_code: ErrorCode.INTERNAL_ERROR,
        message: 'Server error',
        details: null,
        timestamp: new Date().toISOString(),
      },
    };
    if (!response.success) {
      expect(response.error.error_code).toBe('INTERNAL_ERROR');
    }
  });
});
