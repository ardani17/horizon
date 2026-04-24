// ============================================
// Horizon Trader Platform — Credit Service
// ============================================

import { queryOne, execute, type DbClient } from '../db/query';
import type { SourceType } from '../types/index';

/**
 * Maps article categories to credit source types for transaction records.
 */
const CATEGORY_TO_SOURCE_TYPE: Record<string, SourceType> = {
  trading: 'article_trading',
  life_story: 'article_life_story',
  general: 'article_general',
};

/**
 * Result of a credit award operation.
 */
export interface CreditAwardResult {
  /** Whether credit was actually awarded */
  awarded: boolean;
  /** The amount of credit awarded (0 if not awarded) */
  amount: number;
}

/**
 * Row shape returned when querying credit_settings.
 */
interface CreditSettingsRow {
  credit_reward: number;
  is_active: boolean;
}

/**
 * Reusable credit service for awarding credits on article creation.
 *
 * Encapsulates the atomic credit award flow:
 * 1. Read credit_settings for the article category
 * 2. If reward is active, insert a credit_transaction record
 * 3. Update the user's credit_balance
 * 4. Insert an activity_log entry
 *
 * All operations run within the provided database client (transaction),
 * so the caller is responsible for wrapping in `withTransaction`.
 *
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.4**
 */
export class CreditService {
  /**
   * Award credit to a user for publishing an article.
   *
   * Reads the credit_settings for the given category. If the category reward
   * is active and the reward amount is greater than zero, inserts a credit
   * transaction, updates the user balance, and logs the activity.
   *
   * If the category reward is inactive (is_active = false) or the reward
   * amount is zero, no credit is awarded and the method returns early.
   *
   * @param params.userId - The user to award credit to
   * @param params.articleId - The article that triggered the award (source_id)
   * @param params.category - The article category (used to look up reward)
   * @param params.client - Database client (should be within a transaction)
   * @returns Result indicating whether credit was awarded and the amount
   */
  async awardCreditForArticle(params: {
    userId: string;
    articleId: string;
    category: string;
    client: DbClient;
  }): Promise<CreditAwardResult> {
    const { userId, articleId, category, client } = params;

    // Step 1: Read credit_settings for this category
    const settings = await queryOne<CreditSettingsRow>(
      'SELECT credit_reward, is_active FROM credit_settings WHERE category = $1',
      [category],
      client,
    );

    // Step 2: Skip if no settings found, inactive, or zero reward
    if (!settings || !settings.is_active || settings.credit_reward <= 0) {
      return { awarded: false, amount: 0 };
    }

    const amount = settings.credit_reward;
    const sourceType = CATEGORY_TO_SOURCE_TYPE[category] ?? 'article_general';

    // Step 3: Insert credit transaction
    await execute(
      `INSERT INTO credit_transactions (user_id, amount, transaction_type, source_type, source_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, amount, 'earned', sourceType, articleId, null],
      client,
    );

    // Step 4: Update user balance atomically
    await execute(
      'UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2',
      [amount, userId],
      client,
    );

    // Step 5: Log the credit award activity
    await execute(
      `INSERT INTO activity_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'member',
        'credit_earned',
        'credit',
        articleId,
        JSON.stringify({ amount, category, source_type: sourceType }),
      ],
      client,
    );

    return { awarded: true, amount };
  }
}
