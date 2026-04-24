// ============================================
// Horizon Trader Platform — Middleware Pipeline
// ============================================

import type { BotContext, MiddlewareFn } from './types';

/**
 * Sequential middleware pipeline for the Telegram Bot.
 *
 * Middlewares are executed in registration order. Each middleware receives
 * the bot context and a `next()` function. Calling `next()` passes control
 * to the next middleware. If a middleware does not call `next()`, the
 * pipeline stops (useful for auth rejection, rate limiting, etc.).
 *
 * Validates: Requirements 15.7
 */
export class MiddlewarePipeline {
  private readonly middlewares: MiddlewareFn[] = [];

  /**
   * Register a middleware function. Middlewares execute in the order
   * they are registered.
   */
  use(middleware: MiddlewareFn): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute the pipeline for a given context.
   *
   * Builds a chain of `next()` callbacks so that each middleware
   * can decide whether to continue or halt the pipeline.
   */
  async execute(ctx: BotContext): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index];
        index++;
        await middleware(ctx, next);
      }
    };

    await next();
  }
}
