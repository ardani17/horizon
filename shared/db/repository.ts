// ============================================
// Horizon Trader Platform — Base Repository Pattern
// ============================================

import { QueryResultRow } from 'pg';
import { DbClient, query, queryOne, execute, QueryRows } from './query';

/** Options for paginated queries */
export interface PaginationOptions {
  /** Number of items per page (default: 20) */
  limit?: number;
  /** Number of items to skip (default: 0) */
  offset?: number;
}

/** Result of a paginated query */
export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Base repository class providing common CRUD operations for database entities.
 *
 * Extend this class for each entity to get typed find, create, update, and delete
 * operations out of the box. All methods accept an optional DbClient parameter
 * to support running within transactions.
 *
 * @example
 * ```ts
 * class UserRepository extends BaseRepository<User> {
 *   constructor() {
 *     super('users');
 *   }
 *
 *   async findByTelegramId(telegramId: number, client?: DbClient): Promise<User | null> {
 *     return this.findOneByField('telegram_id', telegramId, client);
 *   }
 * }
 * ```
 */
export class BaseRepository<T extends QueryResultRow> {
  constructor(protected readonly tableName: string) {}

  /**
   * Find a single record by its primary key (id).
   */
  async findById(id: string, client?: DbClient): Promise<T | null> {
    return queryOne<T>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id],
      client,
    );
  }

  /**
   * Find a single record by a specific field value.
   */
  async findOneByField(
    field: string,
    value: unknown,
    client?: DbClient,
  ): Promise<T | null> {
    return queryOne<T>(
      `SELECT * FROM ${this.tableName} WHERE ${field} = $1`,
      [value],
      client,
    );
  }

  /**
   * Find all records matching a field value, ordered by created_at DESC.
   */
  async findByField(
    field: string,
    value: unknown,
    client?: DbClient,
  ): Promise<T[]> {
    const result = await query<T>(
      `SELECT * FROM ${this.tableName} WHERE ${field} = $1 ORDER BY created_at DESC`,
      [value],
      client,
    );
    return result.rows;
  }

  /**
   * Find all records with pagination, ordered by created_at DESC.
   */
  async findAll(
    options?: PaginationOptions,
    client?: DbClient,
  ): Promise<PaginatedResult<T>> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const [dataResult, countResult] = await Promise.all([
      query<T>(
        `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
        client,
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${this.tableName}`,
        [],
        client,
      ),
    ]);

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
      limit,
      offset,
    };
  }

  /**
   * Insert a new record and return the created row.
   *
   * @param data - Object with column names as keys and values to insert
   * @param client - Optional database client for transaction support
   */
  async create(
    data: Record<string, unknown>,
    client?: DbClient,
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const result = await queryOne<T>(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values,
      client,
    );

    if (!result) {
      throw new Error(`Failed to insert into ${this.tableName}`);
    }

    return result;
  }

  /**
   * Update a record by id and return the updated row.
   *
   * @param id - Primary key of the record to update
   * @param data - Object with column names as keys and new values
   * @param client - Optional database client for transaction support
   */
  async update(
    id: string,
    data: Record<string, unknown>,
    client?: DbClient,
  ): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);

    return queryOne<T>(
      `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id],
      client,
    );
  }

  /**
   * Delete a record by id. Returns true if a row was deleted.
   */
  async delete(id: string, client?: DbClient): Promise<boolean> {
    const count = await execute(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id],
      client,
    );
    return count > 0;
  }

  /**
   * Count records matching an optional WHERE clause.
   *
   * @param where - SQL WHERE clause without the WHERE keyword (e.g., "status = $1")
   * @param params - Parameter values for the WHERE clause
   * @param client - Optional database client
   */
  async count(
    where?: string,
    params?: unknown[],
    client?: DbClient,
  ): Promise<number> {
    const sql = where
      ? `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`
      : `SELECT COUNT(*) as count FROM ${this.tableName}`;

    const result = await queryOne<{ count: string }>(sql, params, client);
    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * Execute a raw query with typed results. Useful for complex queries
   * that don't fit the standard CRUD pattern.
   */
  async rawQuery(
    text: string,
    params?: unknown[],
    client?: DbClient,
  ): Promise<QueryRows<T>> {
    return query<T>(text, params, client);
  }
}
