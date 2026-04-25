import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock bcrypt before importing the module under test ----
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

// ---- Mock @shared/db ----
vi.mock('@shared/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}));

import bcrypt from 'bcryptjs';
import { query, execute } from '@shared/db';
import {
  extractApiKey,
  validateApiKey,
  authenticateApiKey,
} from '../../../frontend/src/lib/apiKeyAuth';

const mockQuery = vi.mocked(query);
const mockExecute = vi.mocked(execute);
const mockBcryptCompare = vi.mocked(bcrypt.compare);

// ---- Helper to build a fake API key row ----
function fakeApiKeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-uuid-1',
    key_hash: '$2b$10$hashedvalue',
    key_prefix: 'hzn_abcd',
    app_name: 'Test App',
    created_by: 'admin-uuid-1',
    allowed_origins: 'https://example.com',
    is_active: true,
    last_used_at: null,
    created_at: new Date('2024-01-01'),
    ...overrides,
  };
}

// ---- Tests ----

describe('extractApiKey', () => {
  it('returns null for null header', () => {
    expect(extractApiKey(null)).toBeNull();
  });

  it('returns null for undefined header', () => {
    expect(extractApiKey(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractApiKey('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(extractApiKey('   ')).toBeNull();
  });

  it('returns trimmed key for valid header', () => {
    expect(extractApiKey('hzn_abc123')).toBe('hzn_abc123');
  });

  it('trims whitespace from key', () => {
    expect(extractApiKey('  hzn_abc123  ')).toBe('hzn_abc123');
  });
});

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for empty key', async () => {
    const result = await validateApiKey('');
    expect(result).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns null for whitespace-only key', async () => {
    const result = await validateApiKey('   ');
    expect(result).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns null when no candidates match the prefix', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await validateApiKey('hzn_abcdefghijklmnop');
    expect(result).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE key_prefix = $1'),
      ['hzn_abcd'],
    );
  });

  it('returns null when bcrypt compare fails for all candidates', async () => {
    const row = fakeApiKeyRow();
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    mockBcryptCompare.mockResolvedValueOnce(false as never);

    const result = await validateApiKey('hzn_abcdefghijklmnop');
    expect(result).toBeNull();
  });

  it('returns null when key matches but is inactive', async () => {
    const row = fakeApiKeyRow({ is_active: false });
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    mockBcryptCompare.mockResolvedValueOnce(true as never);

    const result = await validateApiKey('hzn_abcdefghijklmnop');
    expect(result).toBeNull();
    // Should NOT update last_used_at for inactive keys
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns validated key and updates last_used_at on success', async () => {
    const row = fakeApiKeyRow();
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    mockBcryptCompare.mockResolvedValueOnce(true as never);
    mockExecute.mockResolvedValueOnce(1);

    const result = await validateApiKey('hzn_abcdefghijklmnop');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('key-uuid-1');
    expect(result!.app_name).toBe('Test App');
    expect(result!.allowed_origins).toBe('https://example.com');
    expect(result!.is_active).toBe(true);

    // Should update last_used_at
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE api_keys SET last_used_at'),
      ['key-uuid-1'],
    );
  });

  it('does not include key_hash in the returned record', async () => {
    const row = fakeApiKeyRow();
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    mockBcryptCompare.mockResolvedValueOnce(true as never);
    mockExecute.mockResolvedValueOnce(1);

    const result = await validateApiKey('hzn_abcdefghijklmnop');

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('key_hash');
  });

  it('tries multiple candidates and returns the matching one', async () => {
    const row1 = fakeApiKeyRow({ id: 'key-1' });
    const row2 = fakeApiKeyRow({ id: 'key-2', app_name: 'Second App' });
    mockQuery.mockResolvedValueOnce({ rows: [row1, row2], rowCount: 2 });
    // First candidate doesn't match, second does
    mockBcryptCompare.mockResolvedValueOnce(false as never);
    mockBcryptCompare.mockResolvedValueOnce(true as never);
    mockExecute.mockResolvedValueOnce(1);

    const result = await validateApiKey('hzn_abcdefghijklmnop');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('key-2');
    expect(result!.app_name).toBe('Second App');
    expect(mockBcryptCompare).toHaveBeenCalledTimes(2);
  });

  it('uses first 8 characters as prefix for lookup', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await validateApiKey('12345678rest_of_key');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['12345678'],
    );
  });
});

describe('authenticateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when X-API-Key header is missing', async () => {
    const headers = new Headers();
    const result = await authenticateApiKey(headers);
    expect(result).toBeNull();
  });

  it('returns null when X-API-Key header is empty', async () => {
    const headers = new Headers({ 'x-api-key': '' });
    const result = await authenticateApiKey(headers);
    expect(result).toBeNull();
  });

  it('validates and returns key record when header is present', async () => {
    const row = fakeApiKeyRow();
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    mockBcryptCompare.mockResolvedValueOnce(true as never);
    mockExecute.mockResolvedValueOnce(1);

    const headers = new Headers({ 'x-api-key': 'hzn_abcdefghijklmnop' });
    const result = await authenticateApiKey(headers);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('key-uuid-1');
  });

  it('is case-insensitive for header name', async () => {
    const row = fakeApiKeyRow();
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    mockBcryptCompare.mockResolvedValueOnce(true as never);
    mockExecute.mockResolvedValueOnce(1);

    const headers = new Headers({ 'X-API-Key': 'hzn_abcdefghijklmnop' });
    const result = await authenticateApiKey(headers);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('key-uuid-1');
  });

  it('returns null for invalid key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const headers = new Headers({ 'x-api-key': 'invalid_key_value' });
    const result = await authenticateApiKey(headers);

    expect(result).toBeNull();
  });
});
