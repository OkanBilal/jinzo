CREATE TABLE `accounts` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`display_name` text,
	`email` text,
	`company` text,
	`job_title` text,
	`timezone` text,
	`locale` text,
	`website` text,
	`avatar_url` text,
	`bio` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_email` ON `accounts` (`email`);--> statement-breakpoint
CREATE INDEX `idx_accounts_display_name` ON `accounts` (`display_name`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`account_id` text NOT NULL,
	`active_mood_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_mood_id`) REFERENCES `moods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `app_states` (
	`id` text PRIMARY KEY NOT NULL,
	`is_connected` integer DEFAULT false NOT NULL,
	`connection_id` text,
	`display_name` text,
	`icon_path` text,
	`highlighted` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled_features` text,
	`config` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_enabled_features_json" CHECK(json_valid("app_states"."enabled_features") OR "app_states"."enabled_features" IS NULL),
	CONSTRAINT "check_config_json" CHECK(json_valid("app_states"."config") OR "app_states"."config" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_app_states_connected` ON `app_states` (`is_connected`);--> statement-breakpoint
CREATE INDEX `idx_app_states_sort` ON `app_states` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_app_states_updated_at` ON `app_states` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_app_states_created_at` ON `app_states` (`created_at`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`model` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session` ON `chat_messages` (`session_id`);--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`initial_query` text,
	`model` text,
	`mood_id` text,
	`system_prompt_snapshot` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mood_id`) REFERENCES `moods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_updated_at` ON `chat_sessions` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_created_at` ON `chat_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_mood` ON `chat_sessions` (`mood_id`);--> statement-breakpoint
CREATE TABLE `connection_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`external_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`url` text,
	`selected` integer DEFAULT true NOT NULL,
	`metadata` text,
	`last_seen_at` integer,
	`last_ingest_at` integer,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_resources_metadata_json" CHECK(json_valid("connection_resources"."metadata") OR "connection_resources"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_resources_conn_ext` ON `connection_resources` (`connection_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_resources_kind` ON `connection_resources` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_resources_selected` ON `connection_resources` (`selected`);--> statement-breakpoint
CREATE INDEX `idx_resources_conn` ON `connection_resources` (`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_resources_last_ingest` ON `connection_resources` (`last_ingest_at`);--> statement-breakpoint
CREATE INDEX `idx_resources_last_seen` ON `connection_resources` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `connection_sync_state` (
	`connection_id` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`last_sync_at` integer,
	`last_success_at` integer,
	`last_error_at` integer,
	`last_error` text,
	`backoff_until` integer,
	`etag` text,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_sync_cursor_json" CHECK(json_valid("connection_sync_state"."cursor") OR "connection_sync_state"."cursor" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_sync_state_last_sync` ON `connection_sync_state` (`last_sync_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_state_last_success` ON `connection_sync_state` (`last_success_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_state_backoff_until` ON `connection_sync_state` (`backoff_until`);--> statement-breakpoint
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
CREATE INDEX `idx_ct_created_at` ON `connection_tokens` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ct_token_hash` ON `connection_tokens` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_ct_conn_current` ON `connection_tokens` (`connection_id`) WHERE "connection_tokens"."is_current" = 1;--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`type` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`scopes` text,
	`metadata` text,
	`connected_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "check_connections_metadata_json" CHECK(json_valid("connections"."metadata") OR "connections"."metadata" IS NULL),
	CONSTRAINT "check_connections_scopes_json" CHECK(json_valid("connections"."scopes") OR "connections"."scopes" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_connections_provider` ON `connections` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_connections_status` ON `connections` (`status`);--> statement-breakpoint
CREATE INDEX `idx_connections_connected_at` ON `connections` (`connected_at`);--> statement-breakpoint
CREATE INDEX `idx_connections_updated_at` ON `connections` (`updated_at`);--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`connection_id` text,
	`resource_id` text,
	`external_id` text,
	`url` text,
	`title` text,
	`body` text,
	`summary` text,
	`metadata` text,
	`occurred_at` integer,
	`source_updated_at` integer,
	`etag` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resource_id`) REFERENCES `connection_resources`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_entities_metadata_json" CHECK(json_valid("entities"."metadata") OR "entities"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_entities_source` ON `entities` (`connection_id`,`kind`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_entities_account_kind` ON `entities` (`account_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_entities_conn` ON `entities` (`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_entities_resource` ON `entities` (`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_entities_occurred` ON `entities` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_entities_updated` ON `entities` (`updated_at`);--> statement-breakpoint
CREATE TABLE `entity_chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`token_count` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_entity_chunk` ON `entity_chunks` (`entity_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `idx_entity_chunks_entity` ON `entity_chunks` (`entity_id`);--> statement-breakpoint
CREATE TABLE `feed_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`connection_id` text,
	`resource_id` text,
	`entity_id` text,
	`event_type` text NOT NULL,
	`item_type` text,
	`title` text NOT NULL,
	`summary` text,
	`url` text,
	`snapshot` text,
	`metadata` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`embedding` blob,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resource_id`) REFERENCES `connection_resources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_feed_snapshot_json" CHECK(json_valid("feed_items"."snapshot") OR "feed_items"."snapshot" IS NULL),
	CONSTRAINT "check_feed_metadata_json" CHECK(json_valid("feed_items"."metadata") OR "feed_items"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_feed_account_time` ON `feed_items` (`account_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_feed_entity_time` ON `feed_items` (`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_feed_conn_time` ON `feed_items` (`connection_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_feed_event_time` ON `feed_items` (`event_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_feed_item_type_time` ON `feed_items` (`item_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `issues` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`state` text NOT NULL,
	`number` integer,
	`repo` text,
	`assignee` text,
	`labels` text,
	`closed_at` integer,
	`priority` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_issues_labels_json" CHECK(json_valid("issues"."labels") OR "issues"."labels" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_issues_provider_state` ON `issues` (`provider`,`state`);--> statement-breakpoint
CREATE INDEX `idx_issues_repo` ON `issues` (`repo`);--> statement-breakpoint
CREATE TABLE `mood_app_overrides` (
	`mood_id` text NOT NULL,
	`app_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`enabled_features` text,
	`config` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mood_id`) REFERENCES `moods`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `app_states`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_enabled_features_json" CHECK(json_valid("mood_app_overrides"."enabled_features") OR "mood_app_overrides"."enabled_features" IS NULL),
	CONSTRAINT "check_config_json" CHECK(json_valid("mood_app_overrides"."config") OR "mood_app_overrides"."config" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_mood_app` ON `mood_app_overrides` (`mood_id`,`app_id`);--> statement-breakpoint
CREATE TABLE `mood_connections` (
	`mood_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mood_id`) REFERENCES `moods`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_mood_conn` ON `mood_connections` (`mood_id`,`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_mood_conn_conn` ON `mood_connections` (`connection_id`);--> statement-breakpoint
CREATE TABLE `mood_resources` (
	`mood_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mood_id`) REFERENCES `moods`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `connection_resources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_mood_resources_metadata_json" CHECK(json_valid("mood_resources"."metadata") OR "mood_resources"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_mood_resource` ON `mood_resources` (`mood_id`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_mood_resource_resource` ON `mood_resources` (`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_mood_resource_sort` ON `mood_resources` (`mood_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `moods` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`system_prompt` text,
	`model` text,
	`icon` text,
	`theme_config` text,
	`ui_config` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_moods_theme_json" CHECK(json_valid("moods"."theme_config") OR "moods"."theme_config" IS NULL),
	CONSTRAINT "check_moods_ui_json" CHECK(json_valid("moods"."ui_config") OR "moods"."ui_config" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_moods_account_slug` ON `moods` (`account_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_moods_account_name` ON `moods` (`account_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_moods_account` ON `moods` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_moods_sort` ON `moods` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_moods_updated` ON `moods` (`updated_at`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`entity_id` text,
	`connection_id` text,
	`action_type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_run_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_outbox_payload_json" CHECK(json_valid("outbox"."payload"))
);
--> statement-breakpoint
CREATE INDEX `idx_outbox_status_next` ON `outbox` (`status`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `idx_outbox_account` ON `outbox` (`account_id`);--> statement-breakpoint
CREATE TABLE `playlist_items` (
	`playlist_entity_id` text NOT NULL,
	`item_entity_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	`metadata` text,
	FOREIGN KEY (`playlist_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_playlist_items_metadata_json" CHECK(json_valid("playlist_items"."metadata") OR "playlist_items"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_playlist_item` ON `playlist_items` (`playlist_entity_id`,`item_entity_id`);--> statement-breakpoint
CREATE INDEX `idx_playlist_items_order` ON `playlist_items` (`playlist_entity_id`,`position`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`due_at` integer,
	`priority` integer DEFAULT 0 NOT NULL,
	`labels` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_tasks_labels_json" CHECK(json_valid("tasks"."labels") OR "tasks"."labels" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due` ON `tasks` (`due_at`);--> statement-breakpoint
CREATE TABLE `vec_entity_chunk_map` (
	`vec_rowid` integer PRIMARY KEY NOT NULL,
	`chunk_id` integer NOT NULL,
	FOREIGN KEY (`vec_rowid`) REFERENCES `vec_entity_chunks`(`rowid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chunk_id`) REFERENCES `entity_chunks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vec_entity_chunk_map_chunk_id_unique` ON `vec_entity_chunk_map` (`chunk_id`);--> statement-breakpoint
CREATE INDEX `idx_vec_entity_chunk_map_chunk` ON `vec_entity_chunk_map` (`chunk_id`);--> statement-breakpoint
CREATE TABLE `vec_entity_chunks` (
	`rowid` integer PRIMARY KEY NOT NULL,
	`embedding` blob
);
