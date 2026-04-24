// ============================================
// Horizon Trader Platform — Transaction Helper
// ============================================

import { PoolClient } from 'pg';
import { getPool } from './connection';

/**
 * Executes a callback within a database transaction.
 *
 * Acquires a client from the pool, runs BEGIN, executes the callback,
 * and either COMMITs on success or ROLLBACKs on error. The client is
 * always released back to the pool.
 *
 * @param fn - Async function that receives a PoolClient for executing queries
 * @returns The value returned by the callback
 * @throws Re-throws any error from the callback after rolling back
 *
 * @example
 * ```ts
 * const article = await withTransaction(async (client) => {
 *   const article = await queryOne<Article>(
 *     'INSERT INTO articles (...) VALUES (...) RETURNING *',
 *     [...],
 *     client
 *   );
 *   await execute(
 *     'INSERT INTO credit_transactions (...) VALUES (...)',
 *     [...],
 *     client
 *   );
 *   await execute(
 *     'UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2',
 *     [amount, userId],
 *     client
 *   );
 *   return article;
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
