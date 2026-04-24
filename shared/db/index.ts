// ============================================
// Horizon Trader Platform — Database Utilities
// ============================================

export { createPool, getPool, closePool, resetPool, getDbConfig } from './connection';
export type { DbConfig } from './connection';

export { query, queryOne, execute } from './query';
export type { DbClient, QueryRows, QueryRow } from './query';

export { withTransaction } from './transaction';

export { BaseRepository } from './repository';
export type { PaginationOptions, PaginatedResult } from './repository';
