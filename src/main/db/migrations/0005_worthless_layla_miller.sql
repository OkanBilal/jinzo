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
	CONSTRAINT "check_metadata_json" CHECK(json_valid("mood_resources"."metadata") OR "mood_resources"."metadata" IS NULL)
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
	`theme_config` text,
	`ui_config` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_theme_json" CHECK(json_valid("moods"."theme_config") OR "moods"."theme_config" IS NULL),
	CONSTRAINT "check_ui_json" CHECK(json_valid("moods"."ui_config") OR "moods"."ui_config" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_moods_account_slug` ON `moods` (`account_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_moods_account_name` ON `moods` (`account_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_moods_account` ON `moods` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_moods_sort` ON `moods` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_moods_updated` ON `moods` (`updated_at`);--> statement-breakpoint
ALTER TABLE `ChatSession` ADD `mood_id` text REFERENCES moods(id);--> statement-breakpoint
ALTER TABLE `ChatSession` ADD `system_prompt_snapshot` text;--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_mood` ON `ChatSession` (`mood_id`);