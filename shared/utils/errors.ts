// ============================================
// Horizon Trader Platform — Unified Error Handling
// ============================================

import {
  ErrorCode,
  ERROR_CODE_TO_HTTP_STATUS,
  type ApiErrorResponse,
} from '../types/index';

/**
 * Base application error class.
 *
 * Every error carries an `ErrorCode` from the registry, a human-readable
 * message, optional contextual details, and the corresponding HTTP status
 * code (derived automatically from the error code).
 *
 * Subclasses provide convenient constructors for common error categories.
 */
export class AppError extends Error {
  /** Registry error code (e.g. "AUTH_REQUIRED") */
  readonly errorCode: ErrorCode;
  /** HTTP status code derived from the error code */
  readonly httpStatus: number;
  /** Optional contextual details (field errors, balances, etc.) */
  readonly details: Record<string, unknown> | null;

  constructor(
    errorCode: ErrorCode,
    message: string,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'AppError';
    this.errorCode = errorCode;
    this.httpStatus = ERROR_CODE_TO_HTTP_STATUS[errorCode];
    this.details = details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---- Specialised subclasses ----

/** 401 — Authentication required (missing session / API key) */
export class AuthRequiredError extends AppError {
  constructor(message = 'Autentikasi diperlukan', details: Record<string, unknown> | null = null) {
    super(ErrorCode.AUTH_REQUIRED, message, details);
    this.name = 'AuthRequiredError';
  }
}

/** 401 — Authentication invalid (expired session / bad API key) */
export class AuthInvalidError extends AppError {
  constructor(message = 'Sesi atau API key tidak valid', details: Record<string, unknown> | null = null) {
    super(ErrorCode.AUTH_INVALID, message, details);
    this.name = 'AuthInvalidError';
  }
}

/** 403 — Forbidden (role lacks access) */
export class AuthForbiddenError extends AppError {
  constructor(message = 'Akses ditolak', details: Record<string, unknown> | null = null) {
    super(ErrorCode.AUTH_FORBIDDEN, message, details);
    this.name = 'AuthForbiddenError';
  }
}

/** 404 — Resource not found */
export class ResourceNotFoundError extends AppError {
  constructor(message = 'Resource tidak ditemukan', details: Record<string, unknown> | null = null) {
    super(ErrorCode.RESOURCE_NOT_FOUND, message, details);
    this.name = 'ResourceNotFoundError';
  }
}

/** 422 — Validation error */
export class ValidationError extends AppError {
  constructor(message = 'Input tidak valid', details: Record<string, unknown> | null = null) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

/** 422 — Insufficient credit balance */
export class CreditInsufficientError extends AppError {
  constructor(message = 'Saldo credit tidak mencukupi', details: Record<string, unknown> | null = null) {
    super(ErrorCode.CREDIT_INSUFFICIENT, message, details);
    this.name = 'CreditInsufficientError';
  }
}

/** 422 — Invalid media type */
export class MediaTypeInvalidError extends AppError {
  constructor(message = 'Tipe file tidak valid (hanya gambar dan video)', details: Record<string, unknown> | null = null) {
    super(ErrorCode.MEDIA_TYPE_INVALID, message, details);
    this.name = 'MediaTypeInvalidError';
  }
}

/** 422 — Media size exceeded */
export class MediaSizeExceededError extends AppError {
  constructor(message = 'Ukuran file melebihi batas', details: Record<string, unknown> | null = null) {
    super(ErrorCode.MEDIA_SIZE_EXCEEDED, message, details);
    this.name = 'MediaSizeExceededError';
  }
}

/** 429 — Rate limit exceeded */
export class RateLimitExceededError extends AppError {
  constructor(message = 'Terlalu banyak request', details: Record<string, unknown> | null = null) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, details);
    this.name = 'RateLimitExceededError';
  }
}

/** 500 — Internal server error */
export class InternalError extends AppError {
  constructor(message = 'Terjadi kesalahan pada server', details: Record<string, unknown> | null = null) {
    super(ErrorCode.INTERNAL_ERROR, message, details);
    this.name = 'InternalError';
  }
}

// ---- Error response formatter ----

/**
 * Format an `AppError` into a consistent `ApiErrorResponse` structure.
 *
 * The returned object is ready to be serialised as a JSON response body.
 * A `timestamp` in ISO 8601 format is attached automatically.
 */
export function formatErrorResponse(error: AppError): ApiErrorResponse {
  return {
    success: false,
    error: {
      error_code: error.errorCode,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Convert an unknown thrown value into an `AppError`.
 *
 * - If the value is already an `AppError`, return it as-is.
 * - If it is a standard `Error`, wrap it in an `InternalError`.
 * - Otherwise create an `InternalError` with a generic message.
 *
 * This is useful in catch blocks where the thrown value is `unknown`.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  if (err instanceof Error) {
    return new InternalError(err.message);
  }
  return new InternalError('Terjadi kesalahan yang tidak diketahui');
}
