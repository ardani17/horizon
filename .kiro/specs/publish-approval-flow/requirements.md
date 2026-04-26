# Requirements Document

## Introduction

The Horizon Trader Platform's Telegram bot allows users to publish articles via hashtags (`#trading`, `#cerita`, `#general`). Currently, member articles are correctly saved as drafts, but the `/publish` command creates NEW articles from any replied-to message instead of approving existing draft articles. Additionally, published messages remain in the Telegram group, causing clutter. This feature fixes the `/publish` command to only approve existing draft articles, adds Telegram message ID tracking to the articles table, and implements message cleanup after publication to keep the group tidy.

## Glossary

- **Bot**: The grammy-based Telegram bot service that processes messages from the Horizon Trader group chat and publishes articles to the platform
- **Hashtag_Handler**: The component that detects recognized hashtags in Telegram messages and creates articles (draft for members, published for admins)
- **Publish_Handler**: The `/publish` admin-only command handler that approves draft articles by replying to the original member message
- **Command_Registry**: The registry that maps slash commands and hashtag triggers to their handler implementations
- **Article**: A content record in the `articles` database table, containing HTML content, a category, status, and metadata
- **Draft_Article**: An article with `status = 'draft'`, created when a member sends a hashtag message, awaiting admin approval
- **Credit_System**: The subsystem that awards credits to users when their articles are published, with amounts configured per category in the `credit_settings` table
- **Message_Cleanup**: The process of deleting Telegram messages (original message, bot reply, and admin command) after an article is published to reduce group clutter
- **Bot_API**: The grammy bot API instance (`bot.api`) used to call Telegram Bot API methods such as `deleteMessage` and `sendMessage`

## Requirements

### Requirement 1: Store Telegram message IDs on article creation

**User Story:** As a platform maintainer, I want the bot to store the Telegram message ID, bot reply message ID, and chat ID when creating draft articles, so that the system can look up articles by message and clean up messages later.

#### Acceptance Criteria

1. THE articles database table SHALL contain a `telegram_message_id` column of type BIGINT that is nullable
2. THE articles database table SHALL contain a `bot_reply_message_id` column of type BIGINT that is nullable
3. THE articles database table SHALL contain a `telegram_chat_id` column of type BIGINT that is nullable
4. WHEN the Hashtag_Handler creates a draft article for a member, THE Hashtag_Handler SHALL store the original message's `message_id` in the `telegram_message_id` column
5. WHEN the Hashtag_Handler creates a draft article for a member, THE Hashtag_Handler SHALL store the bot's reply message's `message_id` in the `bot_reply_message_id` column
6. WHEN the Hashtag_Handler creates a draft article for a member, THE Hashtag_Handler SHALL store the chat ID in the `telegram_chat_id` column
7. WHEN the Hashtag_Handler creates a published article for an admin, THE Hashtag_Handler SHALL store the original message's `message_id` in the `telegram_message_id` column
8. WHEN the Hashtag_Handler creates a published article for an admin, THE Hashtag_Handler SHALL store the chat ID in the `telegram_chat_id` column

### Requirement 2: Fix /publish to approve existing draft articles only

**User Story:** As an admin, I want `/publish` to only approve existing draft articles (by replying to the original member message), so that arbitrary messages cannot be turned into articles.

#### Acceptance Criteria

1. WHEN an admin replies to a message with `/publish`, THE Publish_Handler SHALL look up an article in the database where `telegram_message_id` matches the replied-to message's `message_id`
2. IF no article is found matching the replied-to message, THEN THE Publish_Handler SHALL reply with "Pesan ini bukan artikel draft" and stop processing
3. IF an article is found but its status is not `draft`, THEN THE Publish_Handler SHALL reply with "Artikel sudah dipublikasikan" and stop processing
4. IF an article is found with `status = 'draft'`, THEN THE Publish_Handler SHALL update the article's status to `published`
5. WHEN the Publish_Handler approves a draft article, THE Publish_Handler SHALL NOT create a new article record
6. WHEN a non-admin user sends `/publish`, THE Publish_Handler SHALL reply with a message indicating only admins can use the command
7. WHEN an admin sends `/publish` without replying to a message, THE Publish_Handler SHALL reply with a usage instruction message

### Requirement 3: Award credits on draft approval

**User Story:** As a member, I want to receive credits when an admin approves my draft article, so that I am rewarded for my contribution.

#### Acceptance Criteria

1. WHEN the Publish_Handler approves a draft article, THE Credit_System SHALL award credits to the article's original author (not the approving admin)
2. WHEN the Publish_Handler approves a draft article, THE Credit_System SHALL use the article's category to determine the credit amount from the `credit_settings` table
3. IF the credit setting for the article's category is inactive or has zero reward, THEN THE Credit_System SHALL not award any credits
4. WHEN credits are awarded on approval, THE Credit_System SHALL insert a credit transaction record with the article's original author as the user

### Requirement 4: Message cleanup after member article approval

**User Story:** As a group member, I want published article messages to be cleaned up from the Telegram group, so that the group chat stays tidy.

#### Acceptance Criteria

1. WHEN the Publish_Handler approves a draft article, THE Bot SHALL delete the original member message (identified by `telegram_message_id` and `telegram_chat_id`)
2. WHEN the Publish_Handler approves a draft article, THE Bot SHALL delete the bot's reply message (identified by `bot_reply_message_id` and `telegram_chat_id`)
3. WHEN the Publish_Handler approves a draft article, THE Bot SHALL delete the admin's `/publish` command message
4. WHEN the Publish_Handler approves a draft article, THE Bot SHALL send a brief confirmation message and auto-delete the confirmation after a short delay
5. IF a message deletion fails (message already deleted, too old, or insufficient permissions), THEN THE Bot SHALL continue processing without interruption
6. THE Bot SHALL require "Delete Messages" admin permission in the Telegram group to perform message cleanup

### Requirement 5: Message cleanup after admin direct publish

**User Story:** As an admin, I want my directly published articles (via hashtag) to also be cleaned up from the group, so that the group stays tidy regardless of who publishes.

#### Acceptance Criteria

1. WHEN the Hashtag_Handler publishes an article immediately for an admin, THE Bot SHALL delete the original admin message (identified by `telegram_message_id` and `telegram_chat_id`)
2. WHEN the Hashtag_Handler publishes an article immediately for an admin, THE Bot SHALL delete the bot's reply message
3. IF a message deletion fails during admin direct publish, THEN THE Bot SHALL continue processing without interruption

### Requirement 6: Expose Bot API to handlers via BotContext

**User Story:** As a developer, I want handlers to access the Telegram Bot API through the BotContext, so that handlers can call `deleteMessage` and other API methods without directly importing the bot instance.

#### Acceptance Criteria

1. THE BotContext interface SHALL include a `deleteMessage` method that accepts a `chatId` (number) and `messageId` (number) and returns a Promise
2. THE BotContext interface SHALL include a `sendMessage` method that accepts a `chatId` (number) and `text` (string) and returns a Promise resolving to the sent message's `message_id`
3. WHEN the bot constructs a BotContext in `bot/src/index.ts`, THE Bot SHALL wire the `deleteMessage` method to call `bot.api.deleteMessage`
4. WHEN the bot constructs a BotContext in `bot/src/index.ts`, THE Bot SHALL wire the `sendMessage` method to call `bot.api.sendMessage`
5. IF a `deleteMessage` call fails, THEN THE BotContext `deleteMessage` method SHALL catch the error and log it without throwing

### Requirement 7: Database migration for Telegram message tracking columns

**User Story:** As a platform maintainer, I want a database migration that adds the Telegram message tracking columns, so that the schema change is versioned and repeatable.

#### Acceptance Criteria

1. THE database migration SHALL add a `telegram_message_id` column of type BIGINT to the articles table, allowing NULL values
2. THE database migration SHALL add a `bot_reply_message_id` column of type BIGINT to the articles table, allowing NULL values
3. THE database migration SHALL add a `telegram_chat_id` column of type BIGINT to the articles table, allowing NULL values
4. THE database migration SHALL create an index on `telegram_message_id` for efficient lookups by message ID
5. THE database migration SHALL be numbered sequentially after the existing migrations (004)

### Requirement 8: Hashtag_Handler reply message for member drafts

**User Story:** As a member, I want to see a clear "waiting for approval" message when I submit an article, so that I know my article was received and is pending admin review.

#### Acceptance Criteria

1. WHEN the Hashtag_Handler creates a draft article for a member, THE Bot SHALL reply with "Artikel dikirim! Menunggu persetujuan admin. Kategori: {category}" (where {category} is the article's category)
2. WHEN the Hashtag_Handler creates a draft article for a member, THE Bot SHALL capture the reply message's `message_id` and store it in the article's `bot_reply_message_id` column
3. WHEN the Hashtag_Handler creates a published article for an admin, THE Bot SHALL reply with "Artikel dipublikasikan! Kategori: {category}"
