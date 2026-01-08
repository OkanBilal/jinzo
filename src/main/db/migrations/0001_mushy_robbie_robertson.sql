PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_FeedItem` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`itemType` text,
	`date` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`source` text NOT NULL,
	`imageUrl` text,
	`metadata` text,
	`embedding` blob,
	`connection_id` text,
	`resource_id` text,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `connection_resources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_metadata_json" CHECK(json_valid("__new_FeedItem"."metadata") OR "__new_FeedItem"."metadata" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_FeedItem`("id", "title", "url", "description", "itemType", "date", "createdAt", "source", "imageUrl", "metadata", "embedding", "connection_id", "resource_id") SELECT "id", "title", "url", "description", "itemType", "date", "createdAt", "source", "imageUrl", "metadata", "embedding", "connection_id", "resource_id" FROM `FeedItem`;--> statement-breakpoint
DROP TABLE `FeedItem`;--> statement-breakpoint
ALTER TABLE `__new_FeedItem` RENAME TO `FeedItem`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `FeedItem_url_unique` ON `FeedItem` (`url`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_connection` ON `FeedItem` (`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_resource` ON `FeedItem` (`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_source` ON `FeedItem` (`source`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_url` ON `FeedItem` (`url`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_date` ON `FeedItem` (`date`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_created_at` ON `FeedItem` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_source_date` ON `FeedItem` (`source`,`date`);--> statement-breakpoint
CREATE TABLE `__new_ChatSession` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`initialQuery` text,
	`model` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_ChatSession`("id", "title", "initialQuery", "model", "createdAt", "updatedAt") SELECT "id", "title", "initialQuery", "model", "createdAt", "updatedAt" FROM `ChatSession`;--> statement-breakpoint
DROP TABLE `ChatSession`;--> statement-breakpoint
ALTER TABLE `__new_ChatSession` RENAME TO `ChatSession`;--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_updated_at` ON `ChatSession` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_created_at` ON `ChatSession` (`createdAt`);--> statement-breakpoint
CREATE TABLE `__new_app_states` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`is_connected` integer DEFAULT false NOT NULL,
	`connection_id` text,
	`display_name` text,
	`icon_type` text,
	`icon_path` text,
	`highlighted` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled_features` text,
	`config` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_enabled_features_json" CHECK(json_valid("__new_app_states"."enabled_features") OR "__new_app_states"."enabled_features" IS NULL),
	CONSTRAINT "check_config_json" CHECK(json_valid("__new_app_states"."config") OR "__new_app_states"."config" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_app_states`("id", "user_id", "is_connected", "connection_id", "display_name", "icon_type", "icon_path", "highlighted", "sort_order", "enabled_features", "config", "created_at", "updated_at") SELECT "id", "user_id", "is_connected", "connection_id", "display_name", "icon_type", "icon_path", "highlighted", "sort_order", "enabled_features", "config", "created_at", "updated_at" FROM `app_states`;--> statement-breakpoint
DROP TABLE `app_states`;--> statement-breakpoint
ALTER TABLE `__new_app_states` RENAME TO `app_states`;--> statement-breakpoint
CREATE INDEX `idx_app_states_user` ON `app_states` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_app_states_connected` ON `app_states` (`is_connected`);--> statement-breakpoint
CREATE INDEX `idx_app_states_sort` ON `app_states` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_app_states_updated_at` ON `app_states` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_app_states_created_at` ON `app_states` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_app_states_user_app` ON `app_states` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_connection_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`external_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`selected` integer DEFAULT true NOT NULL,
	`metadata` text,
	`last_seen_at` integer,
	`last_ingest_at` integer,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_metadata_json" CHECK(json_valid("__new_connection_resources"."metadata") OR "__new_connection_resources"."metadata" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_connection_resources`("id", "connection_id", "external_id", "kind", "name", "selected", "metadata", "last_seen_at", "last_ingest_at") SELECT "id", "connection_id", "external_id", "kind", "name", "selected", "metadata", "last_seen_at", "last_ingest_at" FROM `connection_resources`;--> statement-breakpoint
DROP TABLE `connection_resources`;--> statement-breakpoint
ALTER TABLE `__new_connection_resources` RENAME TO `connection_resources`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_resources_conn_ext` ON `connection_resources` (`connection_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_resources_kind` ON `connection_resources` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_resources_selected` ON `connection_resources` (`selected`);--> statement-breakpoint
CREATE INDEX `idx_resources_conn` ON `connection_resources` (`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_resources_last_ingest` ON `connection_resources` (`last_ingest_at`);--> statement-breakpoint
CREATE INDEX `idx_resources_last_seen` ON `connection_resources` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `idx_resources_last_seen_selected` ON `connection_resources` (`last_seen_at`,`selected`);--> statement-breakpoint
CREATE TABLE `__new_connection_sync_state` (
	`connection_id` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`last_sync_at` integer,
	`last_success_at` integer,
	`last_error_at` integer,
	`last_error` text,
	`backoff_until` integer,
	`etag` text,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_cursor_json" CHECK(json_valid("__new_connection_sync_state"."cursor") OR "__new_connection_sync_state"."cursor" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_connection_sync_state`("connection_id", "cursor", "last_sync_at", "last_success_at", "last_error_at", "last_error", "backoff_until", "etag") SELECT "connection_id", "cursor", "last_sync_at", "last_success_at", "last_error_at", "last_error", "backoff_until", "etag" FROM `connection_sync_state`;--> statement-breakpoint
DROP TABLE `connection_sync_state`;--> statement-breakpoint
ALTER TABLE `__new_connection_sync_state` RENAME TO `connection_sync_state`;--> statement-breakpoint
CREATE INDEX `idx_sync_state_last_sync` ON `connection_sync_state` (`last_sync_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_state_last_success` ON `connection_sync_state` (`last_success_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_state_backoff_until` ON `connection_sync_state` (`backoff_until`);--> statement-breakpoint
CREATE INDEX `idx_ct_created_at` ON `connection_tokens` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ct_expires_current` ON `connection_tokens` (`expires_at`,`is_current`);--> statement-breakpoint
CREATE TABLE `__new_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`provider` text NOT NULL,
	`type` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`scopes` text,
	`metadata` text,
	`connected_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "check_metadata_json" CHECK(json_valid("__new_connections"."metadata") OR "__new_connections"."metadata" IS NULL),
	CONSTRAINT "check_scopes_json" CHECK(json_valid("__new_connections"."scopes") OR "__new_connections"."scopes" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_connections`("id", "user_id", "provider", "type", "display_name", "status", "scopes", "metadata", "connected_at", "updated_at") SELECT "id", "user_id", "provider", "type", "display_name", "status", "scopes", "metadata", "connected_at", "updated_at" FROM `connections`;--> statement-breakpoint
DROP TABLE `connections`;--> statement-breakpoint
ALTER TABLE `__new_connections` RENAME TO `connections`;--> statement-breakpoint
CREATE INDEX `idx_connections_provider` ON `connections` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_connections_user` ON `connections` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_connections_status` ON `connections` (`status`);--> statement-breakpoint
CREATE INDEX `idx_connections_connected_at` ON `connections` (`connected_at`);--> statement-breakpoint
CREATE INDEX `idx_connections_updated_at` ON `connections` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_connections_user_provider` ON `connections` (`user_id`,`provider`);