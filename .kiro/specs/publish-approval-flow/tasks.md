# Implementation Plan: Publish Approval Flow

## Overview

Transform the `/publish` command from creating new articles to approving existing drafts, add Telegram message ID tracking to the articles table, and implement message cleanup after publication. Tasks are ordered so dependencies are satisfied: database migration first, then shared types, then BotContext interface/wiring, then database functions, then handler updates, and finally tests.

## Tasks

- [x] 1. Database migration and shared types
  - [x] 1.1 Create database migration 004 to add Telegram message tracking columns
    - Create `db/migrations/004_add_telegram_message_tracking.sql`
    - Add `telegram_message_id BIGINT` nullable column to articles table
    - Add `bot_reply_message_id BIGINT` nullable column to articles table
    - Add `telegram_chat_id BIGINT` nullable column to articles table
    - Create index `idx_articles_telegram_message_id` on `telegram_message_id`
    - Use `IF NOT EXISTS` for idempotent execution
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 1.2 Update Article interface in shared/types/index.ts
    - Add `telegram_message_id: number | null` to the `Article` interface
    - Add `bot_reply_message_id: number | null` to the `Article` interface
    - Add `telegram_chat_id: number | null` to the `Article` interface
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. BotContext interface and wiring
  - [x] 2.1 Add new methods to BotContext interface in bot/src/middleware/types.ts
    - Add `replyWithMessageId(text: string): Promise<number>` method
    - Add `deleteMessage(chatId: number, messageId: number): Promise<void>` method
    - Add `sendMessage(chatId: number, text: string): Promise<number>` method
    - _Requirements: 6.1, 6.2_

  - [x] 2.2 Wire new BotContext methods in bot/src/index.ts
    - Implement `replyWithMessageId` to call `ctx.reply(text)` and return `sent.message_id`
    - Implement `deleteMessage` to call `bot.api.deleteMessage(chatId, messageId)` wrapped in try/catch that logs errors without throwing
    - Implement `sendMessage` to call `bot.api.sendMessage(chatId, text)` and return `sent.message_id`
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 3. Database functions and insertArticle update
  - [x] 3.1 Update insertArticle function in bot/src/index.ts to accept Telegram columns
    - Add optional `telegram_message_id`, `bot_reply_message_id`, `telegram_chat_id` fields to the data parameter
    - Update the SQL INSERT to include the three new columns with `$8, $9, $10` parameters
    - Default missing values to `null`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 Add new database functions in bot/src/index.ts
    - Add `findArticleByMessageId(telegramMessageId: number)` — SELECT article by `telegram_message_id`, returning id, author_id, category, status, and all three telegram columns
    - Add `updateArticleStatus(articleId: string, status: string, client: DbClient)` — UPDATE articles SET status
    - Add `updateArticleReplyMessageId(articleId: string, botReplyMessageId: number)` — UPDATE articles SET bot_reply_message_id
    - _Requirements: 2.1, 2.4_

- [x] 4. Checkpoint - Verify compilation
  - Ensure the project compiles with `tsc --noEmit` in the bot directory
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update HashtagHandler to store message IDs and perform cleanup
  - [x] 5.1 Update HashtagHandlerDeps interface and insertArticle call
    - Add `updateArticleReplyMessageId` to `HashtagHandlerDeps` interface
    - Update `insertArticle` call to pass `telegram_message_id: ctx.message.message_id` and `telegram_chat_id: ctx.message.chat.id`
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 5.2 Update member draft reply to capture bot_reply_message_id
    - Replace `ctx.reply(replyMessage)` with `ctx.replyWithMessageId(replyMessage)` for member drafts
    - After reply, call `this.deps.updateArticleReplyMessageId(article.id, replyMessageId)` to store the bot reply message ID
    - Update member draft reply text to: "Artikel dikirim! Menunggu persetujuan admin. Kategori: {category}"
    - _Requirements: 8.1, 8.2_

  - [x] 5.3 Implement admin direct publish message cleanup
    - For admin publishes, use `ctx.replyWithMessageId()` to get the reply message ID
    - Update admin reply text to: "Artikel dipublikasikan! Kategori: {category}"
    - After reply, call `ctx.deleteMessage(ctx.message.chat.id, ctx.message.message_id)` to delete original admin message
    - Call `ctx.deleteMessage(ctx.message.chat.id, replyMessageId)` to delete bot reply
    - Wrap deletions in best-effort pattern (continue on failure)
    - _Requirements: 5.1, 5.2, 5.3, 8.3_

  - [x] 5.4 Wire updateArticleReplyMessageId in bot/src/index.ts handler dependencies
    - Add `updateArticleReplyMessageId` to `sharedHandlerDeps` and `mediaHandlerDeps` objects
    - _Requirements: 1.5, 8.2_

  - [ ]* 5.5 Write property test: Member draft stores all Telegram IDs
    - **Property 1: Member draft article stores all Telegram IDs**
    - Use fast-check to generate arbitrary message IDs, chat IDs, and user data
    - Verify that after HashtagHandler executes for a member, `insertArticle` is called with `telegram_message_id` and `telegram_chat_id`, and `updateArticleReplyMessageId` is called with the reply message ID
    - **Validates: Requirements 1.4, 1.5, 1.6, 8.2**

  - [ ]* 5.6 Write property test: Admin publish stores Telegram IDs
    - **Property 2: Admin publish article stores Telegram IDs**
    - Use fast-check to generate arbitrary message IDs, chat IDs, and admin user data
    - Verify that after HashtagHandler executes for an admin, `insertArticle` is called with `telegram_message_id` and `telegram_chat_id`
    - **Validates: Requirements 1.7, 1.8**

  - [ ]* 5.7 Write property test: Admin direct publish cleans up messages
    - **Property 7: Admin direct publish cleans up messages**
    - Use fast-check to generate arbitrary message IDs and chat IDs
    - Verify that after HashtagHandler executes for an admin, `deleteMessage` is called for both the original message and the bot reply
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 5.8 Write property test: Reply messages include correct category
    - **Property 8: Reply messages include correct category**
    - Use fast-check to generate arbitrary categories and user roles
    - Verify member draft reply contains "Menunggu persetujuan admin" and the category, admin reply contains "dipublikasikan" and the category
    - **Validates: Requirements 8.1, 8.3**

- [x] 6. Rewrite PublishHandler to approve drafts only
  - [x] 6.1 Replace PublishHandlerDeps interface
    - Remove `insertArticle`, `insertMedia`, `uploadMedia` dependencies
    - Add `findArticleByMessageId` dependency
    - Add `updateArticleStatus` dependency
    - Keep `withTransaction`, `getCreditReward`, `insertCreditTransaction`, `updateCreditBalance`
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 6.2 Rewrite PublishHandler.execute method
    - Check `ctx.user.role !== 'admin'` → reply "Hanya admin yang dapat menggunakan command /publish." and return
    - Check `ctx.message.reply_to_message` missing → reply "Gunakan /publish dengan membalas pesan yang ingin dipublikasikan." and return
    - Call `findArticleByMessageId(reply_to_message.message_id)` → if null, reply "Pesan ini bukan artikel draft" and return
    - Check `article.status !== 'draft'` → reply "Artikel sudah dipublikasikan" and return
    - Inside transaction: call `updateArticleStatus(article.id, 'published', client)`
    - Inside transaction: award credits to `article.author_id` (not ctx.user.id) using category from the found article
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4_

  - [x] 6.3 Implement message cleanup in PublishHandler
    - After transaction: delete original member message using `ctx.deleteMessage(article.telegram_chat_id, article.telegram_message_id)`
    - Delete bot reply using `ctx.deleteMessage(article.telegram_chat_id, article.bot_reply_message_id)`
    - Delete admin's `/publish` command using `ctx.deleteMessage(ctx.message.chat.id, ctx.message.message_id)`
    - Send confirmation via `ctx.sendMessage(chatId, 'Artikel berhasil dipublikasikan!')` and auto-delete after ~5 seconds using fire-and-forget setTimeout
    - All deletions are best-effort (continue on failure)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.4 Update PublishHandler instantiation in bot/src/index.ts
    - Replace `mediaHandlerDeps` with new dependency object containing `findArticleByMessageId`, `withTransaction`, `updateArticleStatus`, `getCreditReward`, `insertCreditTransaction`, `updateCreditBalance`
    - _Requirements: 2.1, 2.4_

  - [ ]* 6.5 Write property test: Draft approval updates existing article without creating new ones
    - **Property 3: Draft approval updates existing article without creating new ones**
    - Use fast-check to generate arbitrary draft articles and admin users
    - Verify `updateArticleStatus` is called with the existing article ID and 'published', and `insertArticle` is never called
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 6.6 Write property test: Credits awarded to original author
    - **Property 4: Credits awarded to original author with category-based amount**
    - Use fast-check to generate arbitrary draft articles with different author_ids and categories, and arbitrary credit settings
    - Verify credit transaction references `article.author_id` (not admin's user ID) and amount matches `credit_reward` for the category
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [ ]* 6.7 Write property test: Draft approval deletes all three messages
    - **Property 5: Draft approval deletes all three messages**
    - Use fast-check to generate arbitrary articles with stored telegram IDs
    - Verify `deleteMessage` is called for: original member message, bot reply message, and admin's /publish command message
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 6.8 Write property test: Message deletion failures do not interrupt processing
    - **Property 6: Message deletion failures do not interrupt processing**
    - Use fast-check to generate arbitrary articles; configure `deleteMessage` mock to throw errors
    - Verify the handler completes successfully — article status is updated and credits are awarded despite deletion failures
    - **Validates: Requirements 4.5, 5.3, 6.5**

- [x] 7. Checkpoint - Compile and run all tests
  - Ensure the project compiles with `tsc --noEmit` in the bot directory
  - Run all property-based and unit tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Unit tests for edge cases
  - [ ]* 8.1 Write unit tests for PublishHandler edge cases
    - Test: non-admin user receives rejection message (Req 2.6)
    - Test: missing reply_to_message receives usage instruction (Req 2.7)
    - Test: no article found replies "Pesan ini bukan artikel draft" (Req 2.2)
    - Test: non-draft article replies "Artikel sudah dipublikasikan" (Req 2.3)
    - Test: credits not awarded when credit_reward is 0 (Req 3.3)
    - Test: credits not awarded when is_active is false (Req 3.3)
    - Test: confirmation message is sent and auto-deleted (Req 4.4)
    - _Requirements: 2.2, 2.3, 2.6, 2.7, 3.3, 4.4_

  - [ ]* 8.2 Write unit tests for HashtagHandler message ID storage
    - Test: member draft stores telegram_message_id and telegram_chat_id in insertArticle call
    - Test: member draft calls updateArticleReplyMessageId after reply
    - Test: admin publish stores telegram_message_id and telegram_chat_id
    - Test: admin publish deletes original message and bot reply
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 5.1, 5.2_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major changes
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The project currently has no test framework installed — test tasks will need to set up vitest and fast-check as dev dependencies
