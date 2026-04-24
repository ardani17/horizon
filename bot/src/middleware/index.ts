// ============================================
// Horizon Trader Platform — Middleware Barrel Export
// ============================================

export type { BotContext, MiddlewareFn, TelegramMessage } from './types';
export { MiddlewarePipeline } from './pipeline';
export { createAuthMiddleware } from './auth';
export type { AuthMiddlewareOptions } from './auth';
export { createAutoRegisterMiddleware } from './autoRegister';
export type { AutoRegisterMiddlewareOptions } from './autoRegister';
export { createLoggingMiddleware } from './logging';
export type { LoggingMiddlewareOptions } from './logging';
export { createRateLimiterMiddleware, createRateLimiterMiddlewareWithStore } from './rateLimiter';
export type { RateLimiterOptions } from './rateLimiter';
