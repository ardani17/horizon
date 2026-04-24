import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Pool, PoolClient, QueryResult } from 'pg';

// ---- Connection tests ----

describe('Database Connection', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear env vars before each test
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.DB_MAX_CONNECTIONS;
    delete process.env.DB_IDLE_TIMEOUT_MS;
    delete process.env.DB_CONNECTION_TIMEOUT_MS;
  });

  it('getDbConfig returns defaults when no env vars are set', async () => {
    const { getDbConfig } = await import('../../../shared/db/connection');
    const config = getDbConfig();

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
    expect(config.database).toBe('horizon');
    expect(config.user).toBe('horizon_user');
    expect(config.password).toBe('');
    expect(config.maxConnections).toBe(20);
    expect(config.idleTimeoutMs).toBe(30000);
    expect(config.connectionTimeoutMs).toBe(5000);
  });

  it('getDbConfig reads from environment variables', async () => {
    process.env.POSTGRES_HOST = 'db-host';
    process.env.POSTGRES_PORT = '5433';
    process.env.POSTGRES_DB = 'testdb';
    process.env.POSTGRES_USER = 'testuser';
    process.env.POSTGRES_PASSWORD = 'testpass';
    process.env.DB_MAX_CONNECTIONS = '10';
    process.env.DB_IDLE_TIMEOUT_MS = '15000';
    process.env.DB_CONNECTION_TIMEOUT_MS = '3000';

    const { getDbConfig } = await import('../../../shared/db/connection');
    const config = getDbConfig();

    expect(config.host).toBe('db-host');
    expect(config.port).toBe(5433);
    expect(config.database).toBe('testdb');
    expect(config.user).toBe('testuser');
    expect(config.password).toBe('testpass');
    expect(config.maxConnections).toBe(10);
    expect(config.idleTimeoutMs).toBe(15000);
    expect(config.connectionTimeoutMs).toBe(3000);
  });

  it('createPool returns a Pool instance', async () => {
    const { createPool } = await import('../../../shared/db/connection');
    const pool = createPool({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
    });

    expect(pool).toBeInstanceOf(Pool);
    await pool.end();
  });

  it('createPool uses DATABASE_URL when set', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';

    const { createPool } = await import('../../../shared/db/connection');
    const pool = createPool();

    expect(pool).toBeInstanceOf(Pool);
    await pool.end();
  });

  it('getPool returns the same instance on multiple calls', async () => {
    const { getPool, closePool } = await import('../../../shared/db/connection');
    const pool1 = getPool();
    const pool2 = getPool();

    expect(pool1).toBe(pool2);
    await closePool();
  });

  it('closePool sets singleton to null', async () => {
    const { getPool, closePool } = await import('../../../shared/db/connection');
    const pool1 = getPool();
    await closePool();
    const pool2 = getPool();

    expect(pool1).not.toBe(pool2);
    await closePool();
  });

  it('resetPool replaces the singleton', async () => {
    const { getPool, resetPool, closePool } = await import('../../../shared/db/connection');
    const pool1 = getPool();

    const customPool = new Pool({ host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test' });
    resetPool(customPool);

    const pool2 = getPool();
    expect(pool2).toBe(customPool);
    expect(pool2).not.toBe(pool1);

    await pool1.end();
    await closePool();
  });
});

// ---- Query helper tests ----

describe('Query Helpers', () => {
  function createMockClient(): DbClient {
    return {
      query: vi.fn(),
    } as unknown as DbClient;
  }

  // Need to import DbClient type
  type DbClient = Pool | PoolClient;

  it('query returns typed rows and rowCount', async () => {
    const { query } = await import('../../../shared/db/query');
    const mockClient = createMockClient();
    const mockResult: QueryResult = {
      rows: [{ id: '1', username: 'alice' }, { id: '2', username: 'bob' }],
      rowCount: 2,
      command: 'SELECT',
      oid: 0,
      fields: [],
    };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await query<{ id: string; username: string }>(
      'SELECT * FROM users',
      [],
      mockClient,
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].username).toBe('alice');
    expect(result.rowCount).toBe(2);
    expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users', []);
  });

  it('query handles null rowCount', async () => {
    const { query } = await import('../../../shared/db/query');
    const mockClient = createMockClient();
    const mockResult: QueryResult = {
      rows: [],
      rowCount: null,
      command: 'SELECT',
      oid: 0,
      fields: [],
    };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await query('SELECT 1', [], mockClient);
    expect(result.rowCount).toBe(0);
  });

  it('queryOne returns first row when found', async () => {
    const { queryOne } = await import('../../../shared/db/query');
    const mockClient = createMockClient();
    const mockResult: QueryResult = {
      rows: [{ id: '1', username: 'alice' }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await queryOne<{ id: string; username: string }>(
      'SELECT * FROM users WHERE id = $1',
      ['1'],
      mockClient,
    );

    expect(result).not.toBeNull();
    expect(result!.username).toBe('alice');
  });

  it('queryOne returns null when no rows', async () => {
    const { queryOne } = await import('../../../shared/db/query');
    const mockClient = createMockClient();
    const mockResult: QueryResult = {
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await queryOne('SELECT * FROM users WHERE id = $1', ['nonexistent'], mockClient);
    expect(result).toBeNull();
  });

  it('execute returns affected row count', async () => {
    const { execute } = await import('../../../shared/db/query');
    const mockClient = createMockClient();
    const mockResult: QueryResult = {
      rows: [],
      rowCount: 3,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const count = await execute(
      'UPDATE users SET role = $1 WHERE role = $2',
      ['admin', 'member'],
      mockClient,
    );

    expect(count).toBe(3);
  });
});

// ---- Transaction tests ----

describe('Transaction Helper', () => {
  it('withTransaction commits on success', async () => {
    const { withTransaction } = await import('../../../shared/db/transaction');
    const { resetPool, closePool } = await import('../../../shared/db/connection');

    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    resetPool(mockPool);

    const result = await withTransaction(async (client) => {
      expect(client).toBe(mockClient);
      return 'success';
    });

    expect(result).toBe('success');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect((mockClient as unknown as { release: () => void }).release).toHaveBeenCalled();

    await closePool();
  });

  it('withTransaction rolls back on error', async () => {
    const { withTransaction } = await import('../../../shared/db/transaction');
    const { resetPool, closePool } = await import('../../../shared/db/connection');

    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    resetPool(mockPool);

    const testError = new Error('Something went wrong');

    await expect(
      withTransaction(async () => {
        throw testError;
      }),
    ).rejects.toThrow('Something went wrong');

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect((mockClient as unknown as { release: () => void }).release).toHaveBeenCalled();

    await closePool();
  });

  it('withTransaction always releases client even on error', async () => {
    const { withTransaction } = await import('../../../shared/db/transaction');
    const { resetPool, closePool } = await import('../../../shared/db/connection');

    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    resetPool(mockPool);

    try {
      await withTransaction(async () => {
        throw new Error('fail');
      });
    } catch {
      // expected
    }

    expect((mockClient as unknown as { release: () => void }).release).toHaveBeenCalledTimes(1);

    await closePool();
  });
});

// ---- BaseRepository tests ----

describe('BaseRepository', () => {
  function createMockClient() {
    return {
      query: vi.fn(),
    } as unknown as Pool;
  }

  it('findById queries by id', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    const mockRow = { id: '123', username: 'alice' };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [mockRow],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository<{ id: string; username: string }>('users');
    const result = await repo.findById('123', mockClient);

    expect(result).toEqual(mockRow);
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE id = $1',
      ['123'],
    );
  });

  it('findById returns null when not found', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('users');
    const result = await repo.findById('nonexistent', mockClient);

    expect(result).toBeNull();
  });

  it('findOneByField queries by arbitrary field', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    const mockRow = { id: '1', telegram_id: 12345 };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [mockRow],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('users');
    const result = await repo.findOneByField('telegram_id', 12345, mockClient);

    expect(result).toEqual(mockRow);
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE telegram_id = $1',
      [12345],
    );
  });

  it('findByField returns array ordered by created_at DESC', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    const mockRows = [
      { id: '2', category: 'trading' },
      { id: '1', category: 'trading' },
    ];
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: mockRows,
      rowCount: 2,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('articles');
    const result = await repo.findByField('category', 'trading', mockClient);

    expect(result).toEqual(mockRows);
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM articles WHERE category = $1 ORDER BY created_at DESC',
      ['trading'],
    );
  });

  it('findAll returns paginated results with defaults', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    const mockRows = [{ id: '1' }, { id: '2' }];

    (mockClient.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: mockRows, rowCount: 2, command: 'SELECT', oid: 0, fields: [] })
      .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] });

    const repo = new BaseRepository('articles');
    const result = await repo.findAll(undefined, mockClient);

    expect(result.rows).toEqual(mockRows);
    expect(result.total).toBe(50);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('findAll respects pagination options', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();

    (mockClient.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [{ id: '3' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
      .mockResolvedValueOnce({ rows: [{ count: '100' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] });

    const repo = new BaseRepository('articles');
    const result = await repo.findAll({ limit: 10, offset: 20 }, mockClient);

    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
    expect(result.total).toBe(100);
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM articles ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [10, 20],
    );
  });

  it('create inserts and returns the new row', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    const newRow = { id: 'new-id', username: 'charlie', role: 'member' };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [newRow],
      rowCount: 1,
      command: 'INSERT',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('users');
    const result = await repo.create({ username: 'charlie', role: 'member' }, mockClient);

    expect(result).toEqual(newRow);
    expect(mockClient.query).toHaveBeenCalledWith(
      'INSERT INTO users (username, role) VALUES ($1, $2) RETURNING *',
      ['charlie', 'member'],
    );
  });

  it('create throws when insert returns no rows', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'INSERT',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('users');
    await expect(repo.create({ username: 'fail' }, mockClient)).rejects.toThrow(
      'Failed to insert into users',
    );
  });

  it('update modifies and returns the updated row', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    const updatedRow = { id: '123', role: 'admin' };
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [updatedRow],
      rowCount: 1,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('users');
    const result = await repo.update('123', { role: 'admin' }, mockClient);

    expect(result).toEqual(updatedRow);
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
      ['admin', '123'],
    );
  });

  it('update returns null when record not found', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('users');
    const result = await repo.update('nonexistent', { role: 'admin' }, mockClient);

    expect(result).toBeNull();
  });

  it('delete returns true when row is deleted', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [],
      rowCount: 1,
      command: 'DELETE',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('users');
    const result = await repo.delete('123', mockClient);

    expect(result).toBe(true);
  });

  it('delete returns false when no row found', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'DELETE',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('users');
    const result = await repo.delete('nonexistent', mockClient);

    expect(result).toBe(false);
  });

  it('count returns total without where clause', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [{ count: '42' }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('articles');
    const result = await repo.count(undefined, undefined, mockClient);

    expect(result).toBe(42);
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM articles',
      undefined,
    );
  });

  it('count returns filtered total with where clause', async () => {
    const { BaseRepository } = await import('../../../shared/db/repository');
    const mockClient = createMockClient();
    (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [{ count: '15' }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const repo = new BaseRepository('articles');
    const result = await repo.count('status = $1', ['published'], mockClient);

    expect(result).toBe(15);
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM articles WHERE status = $1',
      ['published'],
    );
  });
});
