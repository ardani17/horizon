// ============================================
// Horizon Trader Platform — Database Connection Pool
// ============================================

import { Pool, PoolConfig } from 'pg';

/** Database connection configuration from environment variables */
export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** Maximum number of clients in the pool (default: 20) */
  maxConnections?: number;
  /** Idle timeout in milliseconds before a client is closed (default: 30000) */
  idleTimeoutMs?: number;
  /** Connection timeout in milliseconds (default: 5000) */
  connectionTimeoutMs?: number;
}

/**
 * Reads database configuration from environment variables.
 * Falls back to individual POSTGRES_* vars if DATABASE_URL is not set.
 */
export function getDbConfig(): DbConfig {
  return {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'horizon',
    user: process.env.POSTGRES_USER ?? 'horizon_user',
    password: process.env.POSTGRES_PASSWORD ?? '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS ?? '20', 10),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '30000', 10),
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '5000', 10),
  };
}

/**
 * Creates a PostgreSQL connection pool from the given config.
 * If DATABASE_URL is set, it takes precedence over individual config fields.
 */
export function createPool(config?: DbConfig): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const poolConfig: PoolConfig = {
      connectionString: databaseUrl,
      max: config?.maxConnections ?? 20,
      idleTimeoutMillis: config?.idleTimeoutMs ?? 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMs ?? 5000,
    };
    return new Pool(poolConfig);
  }

  const cfg = config ?? getDbConfig();
  const poolConfig: PoolConfig = {
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    max: cfg.maxConnections ?? 20,
    idleTimeoutMillis: cfg.idleTimeoutMs ?? 30000,
    connectionTimeoutMillis: cfg.connectionTimeoutMs ?? 5000,
  };

  return new Pool(poolConfig);
}

/** Singleton pool instance, lazily initialized */
let _pool: Pool | null = null;

/**
 * Returns the shared connection pool singleton.
 * Creates the pool on first call using environment configuration.
 */
export function getPool(): Pool {
  if (!_pool) {
    _pool = createPool();
  }
  return _pool;
}

/**
 * Gracefully shuts down the connection pool.
 * Should be called during application shutdown.
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * Resets the singleton pool (useful for testing).
 */
export function resetPool(pool?: Pool): void {
  _pool = pool ?? null;
}
