CREATE TABLE `app_states` (
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
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_app_states_user` ON `app_states` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_app_states_connected` ON `app_states` (`is_connected`);--> statement-breakpoint
CREATE INDEX `idx_app_states_sort` ON `app_states` (`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_app_states_user_app` ON `app_states` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `ChatMessage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`model` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sessionId`) REFERENCES `ChatSession`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session` ON `ChatMessage` (`sessionId`);--> statement-breakpoint
CREATE TABLE `ChatSession` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`initialQuery` text,
	`model` text,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connection_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`external_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`selected` integer DEFAULT true NOT NULL,
	`metadata` text,
	`last_seen_at` integer,
	`last_ingest_at` integer,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_resources_conn_ext` ON `connection_resources` (`connection_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_resources_kind` ON `connection_resources` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_resources_selected` ON `connection_resources` (`selected`);--> statement-breakpoint
CREATE INDEX `idx_resources_conn` ON `connection_resources` (`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_resources_last_ingest` ON `connection_resources` (`last_ingest_at`);--> statement-breakpoint
CREATE TABLE `connection_sync_state` (
	`connection_id` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`last_sync_at` integer,
	`last_success_at` integer,
	`last_error_at` integer,
	`last_error` text,
	`backoff_until` integer,
	`etag` text,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connection_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` text NOT NULL,
	`access_token_enc` blob,
	`refresh_token_enc` blob,
	`token_type` text,
	`expires_at` integer,
	`token_hash` blob,
	`key_version` integer DEFAULT 1 NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ct_conn` ON `connection_tokens` (`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_ct_current` ON `connection_tokens` (`is_current`);--> statement-breakpoint
CREATE INDEX `idx_ct_expires` ON `connection_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_ct_token_hash` ON `connection_tokens` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_ct_conn_current` ON `connection_tokens` (`connection_id`) WHERE "connection_tokens"."is_current" = 1;--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`provider` text NOT NULL,
	`type` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`scopes` text,
	`metadata` text,
	`connected_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_connections_provider` ON `connections` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_connections_user` ON `connections` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_connections_status` ON `connections` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_connections_user_provider` ON `connections` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `FeedItemChunk` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feed_item_id` integer NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`token_count` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_item_id`) REFERENCES `FeedItem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_feed_item_chunks_feed_item` ON `FeedItemChunk` (`feed_item_id`);--> statement-breakpoint
CREATE INDEX `idx_feed_item_chunks_chunk_index` ON `FeedItemChunk` (`feed_item_id`,`chunk_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_feed_item_chunks_item_idx` ON `FeedItemChunk` (`feed_item_id`,`chunk_index`);--> statement-breakpoint
CREATE TABLE `FeedItem` (
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
	`external_id` text,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `connection_resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `FeedItem_url_unique` ON `FeedItem` (`url`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_connection` ON `FeedItem` (`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_resource` ON `FeedItem` (`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_external_id` ON `FeedItem` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_source` ON `FeedItem` (`source`);--> statement-breakpoint
CREATE TABLE `vec_chunk_map` (
	`vec_rowid` integer PRIMARY KEY NOT NULL,
	`chunk_id` integer NOT NULL,
	FOREIGN KEY (`chunk_id`) REFERENCES `FeedItemChunk`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vec_chunk_map_chunk_id_unique` ON `vec_chunk_map` (`chunk_id`);--> statement-breakpoint
CREATE INDEX `idx_vec_chunk_map_chunk` ON `vec_chunk_map` (`chunk_id`);--> statement-breakpoint
CREATE TABLE `vec_chunks` (
	`rowid` integer PRIMARY KEY NOT NULL,
	`embedding` blob
);
--> statement-breakpoint
CREATE TABLE `vec_feed_item_map` (
	`vec_rowid` integer PRIMARY KEY NOT NULL,
	`feed_item_id` integer NOT NULL,
	FOREIGN KEY (`vec_rowid`) REFERENCES `vec_feed_items`(`rowid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feed_item_id`) REFERENCES `FeedItem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vec_feed_item_map_feed_item_id_unique` ON `vec_feed_item_map` (`feed_item_id`);--> statement-breakpoint
CREATE INDEX `idx_vec_feed_item_map_feed_item` ON `vec_feed_item_map` (`feed_item_id`);--> statement-breakpoint
CREATE TABLE `vec_feed_items` (
	`rowid` integer PRIMARY KEY NOT NULL,
	`embedding` blob
);
