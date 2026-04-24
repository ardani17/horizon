import { describe, it, expect } from 'vitest';
import {
  AppError,
  AuthRequiredError,
  AuthInvalidError,
  AuthForbiddenError,
  ResourceNotFoundError,
  ValidationError,
  CreditInsufficientError,
  MediaTypeInvalidError,
  MediaSizeExceededError,
  RateLimitExceededError,
  InternalError,
  formatErrorResponse,
  toAppError,
} from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/index';

// ---- AppError base class ----

describe('AppError', () => {
  it('stores error code, message, HTTP status, and details', () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, 'bad input', { field: 'email' });
    expect(err.errorCode).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('bad input');
    expect(err.httpStatus).toBe(422);
    expect(err.details).toEqual({ field: 'email' });
  });

  it('defaults details to null', () => {
    const err = new AppError(ErrorCode.INTERNAL_ERROR, 'oops');
    expect(err.details).toBeNull();
  });

  it('is an instance of Error', () => {
    const err = new AppError(ErrorCode.INTERNAL_ERROR, 'oops');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('has name "AppError"', () => {
    const err = new AppError(ErrorCode.INTERNAL_ERROR, 'oops');
    expect(err.name).toBe('AppError');
  });
});

// ---- Subclass hierarchy ----

describe('Error subclasses', () => {
  const cases: Array<{
    Class: new (...args: any[]) => AppError;
    expectedCode: ErrorCode;
    expectedStatus: number;
    expectedName: string;
  }> = [
    { Class: AuthRequiredError, expectedCode: 'AUTH_REQUIRED', expectedStatus: 401, expectedName: 'AuthRequiredError' },
    { Class: AuthInvalidError, expectedCode: 'AUTH_INVALID', expectedStatus: 401, expectedName: 'AuthInvalidError' },
    { Class: AuthForbiddenError, expectedCode: 'AUTH_FORBIDDEN', expectedStatus: 403, expectedName: 'AuthForbiddenError' },
    { Class: ResourceNotFoundError, expectedCode: 'RESOURCE_NOT_FOUND', expectedStatus: 404, expectedName: 'ResourceNotFoundError' },
    { Class: ValidationError, expectedCode: 'VALIDATION_ERROR', expectedStatus: 422, expectedName: 'ValidationError' },
    { Class: CreditInsufficientError, expectedCode: 'CREDIT_INSUFFICIENT', expectedStatus: 422, expectedName: 'CreditInsufficientError' },
    { Class: MediaTypeInvalidError, expectedCode: 'MEDIA_TYPE_INVALID', expectedStatus: 422, expectedName: 'MediaTypeInvalidError' },
    { Class: MediaSizeExceededError, expectedCode: 'MEDIA_SIZE_EXCEEDED', expectedStatus: 422, expectedName: 'MediaSizeExceededError' },
    { Class: RateLimitExceededError, expectedCode: 'RATE_LIMIT_EXCEEDED', expectedStatus: 429, expectedName: 'RateLimitExceededError' },
    { Class: InternalError, expectedCode: 'INTERNAL_ERROR', expectedStatus: 500, expectedName: 'InternalError' },
  ];

  for (const { Class, expectedCode, expectedStatus, expectedName } of cases) {
    describe(expectedName, () => {
      it('uses correct error code and HTTP status', () => {
        const err = new Class();
        expect(err.errorCode).toBe(expectedCode);
        expect(err.httpStatus).toBe(expectedStatus);
      });

      it('has a default message', () => {
        const err = new Class();
        expect(err.message).toBeTruthy();
      });

      it('accepts a custom message and details', () => {
        const err = new Class('custom msg', { key: 'val' });
        expect(err.message).toBe('custom msg');
        expect(err.details).toEqual({ key: 'val' });
      });

      it(`has name "${expectedName}"`, () => {
        const err = new Class();
        expect(err.name).toBe(expectedName);
      });

      it('is an instance of AppError and Error', () => {
        const err = new Class();
        expect(err).toBeInstanceOf(AppError);
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(Class);
      });
    });
  }
});

// ---- formatErrorResponse ----

describe('formatErrorResponse', () => {
  it('produces a valid ApiErrorResponse structure', () => {
    const err = new ValidationError('Email tidak valid', { field: 'email' });
    const response = formatErrorResponse(err);

    expect(response.success).toBe(false);
    expect(response.error.error_code).toBe('VALIDATION_ERROR');
    expect(response.error.message).toBe('Email tidak valid');
    expect(response.error.details).toEqual({ field: 'email' });
    expect(response.error.timestamp).toBeTruthy();
  });

  it('timestamp is a valid ISO 8601 string', () => {
    const err = new InternalError();
    const response = formatErrorResponse(err);
    const parsed = new Date(response.error.timestamp);
    expect(parsed.toISOString()).toBe(response.error.timestamp);
  });

  it('details is null when not provided', () => {
    const err = new ResourceNotFoundError();
    const response = formatErrorResponse(err);
    expect(response.error.details).toBeNull();
  });
});

// ---- toAppError ----

describe('toAppError', () => {
  it('returns the same instance when given an AppError', () => {
    const original = new AuthForbiddenError('nope');
    const result = toAppError(original);
    expect(result).toBe(original);
  });

  it('wraps a standard Error into an InternalError', () => {
    const result = toAppError(new TypeError('bad type'));
    expect(result).toBeInstanceOf(InternalError);
    expect(result.errorCode).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('bad type');
  });

  it('wraps a non-Error value into an InternalError with generic message', () => {
    const result = toAppError('string error');
    expect(result).toBeInstanceOf(InternalError);
    expect(result.message).toBe('Terjadi kesalahan yang tidak diketahui');
  });

  it('wraps null into an InternalError', () => {
    const result = toAppError(null);
    expect(result).toBeInstanceOf(InternalError);
  });
});
