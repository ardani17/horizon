// ============================================
// Horizon Trader Platform — Shared Types
// ============================================

// ---- Enums & Constants ----

/** Article categories */
export const ArticleCategory = {
  TRADING: 'trading',
  LIFE_STORY: 'life_story',
  GENERAL: 'general',
  OUTLOOK: 'outlook',
} as const;

export type ArticleCategory = (typeof ArticleCategory)[keyof typeof ArticleCategory];

/** User roles */
export const UserRole = {
  MEMBER: 'member',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Article statuses */
export const ArticleStatus = {
  PUBLISHED: 'published',
  HIDDEN: 'hidden',
  DRAFT: 'draft',
} as const;

export type ArticleStatus = (typeof ArticleStatus)[keyof typeof ArticleStatus];

/** Article content types */
export const ContentType = {
  SHORT: 'short',
  LONG: 'long',
} as const;

export type ContentType = (typeof ContentType)[keyof typeof ContentType];

/** Article source */
export const ArticleSource = {
  TELEGRAM: 'telegram',
  DASHBOARD: 'dashboard',
} as const;

export type ArticleSource = (typeof ArticleSource)[keyof typeof ArticleSource];

/** Credit transaction types */
export const TransactionType = {
  EARNED: 'earned',
  SPENT: 'spent',
  ADJUSTED: 'adjusted',
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

/** Credit source types */
export const SourceType = {
  ARTICLE_TRADING: 'article_trading',
  ARTICLE_LIFE_STORY: 'article_life_story',
  ARTICLE_GENERAL: 'article_general',
  MANUAL_ADMIN: 'manual_admin',
  EXTERNAL_TOOL: 'external_tool',
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

/** Media types */
export const MediaType = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

export type MediaType = (typeof MediaType)[keyof typeof MediaType];

/** Activity log actor types */
export const ActorType = {
  ADMIN: 'admin',
  MEMBER: 'member',
  SYSTEM: 'system',
  EXTERNAL_API: 'external_api',
} as const;

export type ActorType = (typeof ActorType)[keyof typeof ActorType];

/** Activity log target types */
export const TargetType = {
  ARTICLE: 'article',
  MEDIA: 'media',
  USER: 'user',
  CREDIT: 'credit',
  SETTING: 'setting',
  API_KEY: 'api_key',
} as const;

export type TargetType = (typeof TargetType)[keyof typeof TargetType];

/** Comment statuses */
export const CommentStatus = {
  VISIBLE: 'visible',
  HIDDEN: 'hidden',
} as const;

export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];

// ---- Database Entity Interfaces ----

/** Users table entity */
export interface User {
  id: string;
  telegram_id: number | null;
  username: string | null;
  password_hash: string | null;
  role: UserRole;
  credit_balance: number;
  created_at: Date;
}

/** Articles table entity */
export interface Article {
  id: string;
  author_id: string;
  content_html: string;
  title: string | null;
  category: ArticleCategory;
  content_type: ContentType;
  source: ArticleSource;
  status: ArticleStatus;
  slug: string;
  created_at: Date;
}

/** Media table entity */
export interface Media {
  id: string;
  article_id: string | null;
  file_url: string;
  media_type: MediaType;
  file_key: string | null;
  file_size: number | null;
  created_at: Date;
}

/** Credit transactions table entity */
export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: TransactionType;
  source_type: SourceType;
  source_id: string | null;
  description: string | null;
  created_at: Date;
}

/** Credit settings table entity */
export interface CreditSettings {
  id: string;
  category: ArticleCategory;
  credit_reward: number;
  is_active: boolean;
  updated_at: Date;
}

/** Activity logs table entity */
export interface ActivityLog {
  id: string;
  actor_id: string | null;
  actor_type: ActorType;
  action: string;
  target_type: TargetType | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

/** Comments table entity */
export interface Comment {
  id: string;
  article_id: string;
  user_id: string | null;
  display_name: string;
  content: string;
  is_anonymous: boolean;
  status: CommentStatus;
  created_at: Date;
}

/** Likes table entity */
export interface Like {
  id: string;
  article_id: string;
  fingerprint: string;
  created_at: Date;
}

/** API keys table entity */
export interface ApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  app_name: string;
  created_by: string;
  allowed_origins: string | null;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: Date;
}

/** Admin sessions table entity */
export interface AdminSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

// ---- API Response Types ----

/** Successful API response wrapper */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Error detail within an API error response */
export interface ApiError {
  error_code: ErrorCode;
  message: string;
  details: Record<string, unknown> | null;
  timestamp: string;
}

/** Error API response wrapper */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/** Union type for any API response */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ---- Error Code Registry ----

export const ErrorCode = {
  /** 401 — Session/API key not found */
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  /** 401 — Session expired or API key invalid */
  AUTH_INVALID: 'AUTH_INVALID',
  /** 403 — Role does not have access */
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  /** 404 — Resource not found */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** 422 — Input validation failed */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** 422 — Insufficient credit balance */
  CREDIT_INSUFFICIENT: 'CREDIT_INSUFFICIENT',
  /** 422 — File is not image or video */
  MEDIA_TYPE_INVALID: 'MEDIA_TYPE_INVALID',
  /** 422 — File exceeds size limit */
  MEDIA_SIZE_EXCEEDED: 'MEDIA_SIZE_EXCEEDED',
  /** 429 — Too many requests */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  /** 500 — Internal server error */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Maps error codes to their corresponding HTTP status codes */
export const ERROR_CODE_TO_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.AUTH_INVALID]: 401,
  [ErrorCode.AUTH_FORBIDDEN]: 403,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.CREDIT_INSUFFICIENT]: 422,
  [ErrorCode.MEDIA_TYPE_INVALID]: 422,
  [ErrorCode.MEDIA_SIZE_EXCEEDED]: 422,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
};
