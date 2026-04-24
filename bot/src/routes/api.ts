// ============================================
// Horizon Trader Platform — Bot REST API Routes
// ============================================

import { Router, Request, Response } from 'express';
import type { ICommandRegistry } from '../commands/types';

/**
 * In-memory command usage statistics tracker.
 * Tracks how many times each command has been invoked.
 */
export class CommandStats {
  private readonly counts: Map<string, number> = new Map();

  /** Increment the usage count for a command. */
  increment(commandName: string): void {
    const current = this.counts.get(commandName) ?? 0;
    this.counts.set(commandName, current + 1);
  }

  /** Get usage counts for all commands. */
  getAll(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, count] of this.counts) {
      result[name] = count;
    }
    return result;
  }

  /** Get usage count for a specific command. */
  get(commandName: string): number {
    return this.counts.get(commandName) ?? 0;
  }

  /** Get total invocations across all commands. */
  total(): number {
    let sum = 0;
    for (const count of this.counts.values()) {
      sum += count;
    }
    return sum;
  }
}

/**
 * Dependencies injected into the API router for testability.
 */
export interface ApiRouterDeps {
  /** The command registry to list registered commands */
  registry: ICommandRegistry;
  /** The command usage statistics tracker */
  stats: CommandStats;
  /** Function to send a message to the Telegram group chat */
  sendGroupMessage: (message: string) => Promise<void>;
}

/**
 * Create the bot REST API router.
 *
 * Endpoints:
 * - `GET /commands` — list registered commands
 * - `GET /stats` — command usage statistics
 * - `POST /notify` — send notification to group
 *
 * Validates: Requirements 15.4, 15.5
 */
export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  /**
   * GET /commands
   *
   * Returns the list of registered commands with their metadata.
   */
  router.get('/commands', (_req: Request, res: Response) => {
    const commands = deps.registry.listCommands().map((handler) => ({
      name: handler.name,
      description: handler.description,
      type: handler.type,
      permission: handler.permission,
    }));

    res.json({
      success: true,
      data: { commands },
    });
  });

  /**
   * GET /stats
   *
   * Returns command usage statistics.
   */
  router.get('/stats', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        commandUsage: deps.stats.getAll(),
        totalInvocations: deps.stats.total(),
      },
    });
  });

  /**
   * POST /notify
   *
   * Send a notification message to the Telegram group.
   * Expects JSON body: { "message": "..." }
   */
  router.post('/notify', async (req: Request, res: Response) => {
    const { message } = req.body ?? {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          error_code: 'VALIDATION_ERROR',
          message: 'Field "message" is required and must be a non-empty string.',
          details: null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      await deps.sendGroupMessage(message.trim());
      res.json({
        success: true,
        data: { sent: true },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          error_code: 'INTERNAL_ERROR',
          message: 'Failed to send notification to group.',
          details: null,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  return router;
}
