// ============================================
// Horizon Trader Platform — Typed Query Helpers
// ============================================

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getPool } from './connection';

/** A database client that can execute queries — either a Pool or a PoolClient (for transactions) */
export type DbClient = Pool | PoolClient;

/** Result of a query that returns rows */
export interface QueryRows<T> {
  rows: T[];
  rowCount: number;
}

/** Result of a query that returns a single row or null */
export type QueryRow<T> = T | null;

/**
 * Executes a parameterized query and returns typed rows.
 *
 * @param text - SQL query string with $1, $2, ... placeholders
 * @param params - Parameter values for the query
 * @param client - Optional database client (defaults to the shared pool)
 * @returns Typed query result with rows and rowCount
 *
 * @example
 * ```ts
 * const result = await query<User>('SELECT * FROM users WHERE role = $1', ['admin']);
 * console.log(result.rows); // User[]
 * ```
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  client?: DbClient,
): Promise<QueryRows<T>> {
  const db = client ?? getPool();
  const result: QueryResult<T> = await db.query<T>(text, params);
  return {
    rows: result.rows,
    rowCount: result.rowCount ?? 0,
  };
}

/**
 * Executes a query and returns the first row, or null if no rows match.
 *
 * @param text - SQL query string with $1, $2, ... placeholders
 * @param params - Parameter values for the query
 * @param client - Optional database client (defaults to the shared pool)
 * @returns The first row typed as T, or null
 *
 * @example
 * ```ts
 * const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
 * if (user) { console.log(user.username); }
 * ```
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  client?: DbClient,
): Promise<QueryRow<T>> {
  const result = await query<T>(text, params, client);
  return result.rows[0] ?? null;
}

/**
 * Executes an INSERT, UPDATE, or DELETE and returns the number of affected rows.
 *
 * @param text - SQL statement with $1, $2, ... placeholders
 * @param params - Parameter values
 * @param client - Optional database client (defaults to the shared pool)
 * @returns Number of rows affected
 *
 * @example
 * ```ts
 * const count = await execute(
 *   'UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2',
 *   [10, userId]
 * );
 * ```
 */
export async function execute(
  text: string,
  params?: unknown[],
  client?: DbClient,
): Promise<number> {
  const result = await query(text, params, client);
  return result.rowCount;
}
