ALTER TABLE `mood_app_overrides` RENAME TO `space_app_overrides`;--> statement-breakpoint
ALTER TABLE `mood_connections` RENAME TO `space_connections`;--> statement-breakpoint
ALTER TABLE `mood_resources` RENAME TO `space_resources`;--> statement-breakpoint
ALTER TABLE `mood_tool_permissions` RENAME TO `space_tool_permissions`;--> statement-breakpoint
ALTER TABLE `moods` RENAME TO `spaces`;--> statement-breakpoint
ALTER TABLE `space_app_overrides` RENAME COLUMN "mood_id" TO "space_id";--> statement-breakpoint
ALTER TABLE `space_connections` RENAME COLUMN "mood_id" TO "space_id";--> statement-breakpoint
ALTER TABLE `space_resources` RENAME COLUMN "mood_id" TO "space_id";--> statement-breakpoint
ALTER TABLE `space_tool_permissions` RENAME COLUMN "mood_id" TO "space_id";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_space_app_overrides` (
	`space_id` text NOT NULL,
	`app_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`enabled_features` text,
	`config` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `app_states`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_enabled_features_json" CHECK(json_valid("__new_space_app_overrides"."enabled_features") OR "__new_space_app_overrides"."enabled_features" IS NULL),
	CONSTRAINT "check_config_json" CHECK(json_valid("__new_space_app_overrides"."config") OR "__new_space_app_overrides"."config" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_space_app_overrides`("space_id", "app_id", "enabled", "enabled_features", "config", "created_at") SELECT "space_id", "app_id", "enabled", "enabled_features", "config", "created_at" FROM `space_app_overrides`;--> statement-breakpoint
DROP TABLE `space_app_overrides`;--> statement-breakpoint
ALTER TABLE `__new_space_app_overrides` RENAME TO `space_app_overrides`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_space_app` ON `space_app_overrides` (`space_id`,`app_id`);--> statement-breakpoint
CREATE TABLE `__new_space_connections` (
	`space_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_space_connections`("space_id", "connection_id", "enabled", "created_at") SELECT "space_id", "connection_id", "enabled", "created_at" FROM `space_connections`;--> statement-breakpoint
DROP TABLE `space_connections`;--> statement-breakpoint
ALTER TABLE `__new_space_connections` RENAME TO `space_connections`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_space_conn` ON `space_connections` (`space_id`,`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_space_conn_conn` ON `space_connections` (`connection_id`);--> statement-breakpoint
CREATE TABLE `__new_space_resources` (
	`space_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `connection_resources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_space_resources_metadata_json" CHECK(json_valid("__new_space_resources"."metadata") OR "__new_space_resources"."metadata" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_space_resources`("space_id", "resource_id", "enabled", "sort_order", "metadata", "created_at") SELECT "space_id", "resource_id", "enabled", "sort_order", "metadata", "created_at" FROM `space_resources`;--> statement-breakpoint
DROP TABLE `space_resources`;--> statement-breakpoint
ALTER TABLE `__new_space_resources` RENAME TO `space_resources`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_space_resource` ON `space_resources` (`space_id`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_space_resource_resource` ON `space_resources` (`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_space_resource_sort` ON `space_resources` (`space_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `__new_space_tool_permissions` (
	`space_id` text NOT NULL,
	`tool_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`policy` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_space_tool_policy_json" CHECK(json_valid("__new_space_tool_permissions"."policy") OR "__new_space_tool_permissions"."policy" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_space_tool_permissions`("space_id", "tool_id", "enabled", "policy", "created_at") SELECT "space_id", "tool_id", "enabled", "policy", "created_at" FROM `space_tool_permissions`;--> statement-breakpoint
DROP TABLE `space_tool_permissions`;--> statement-breakpoint
ALTER TABLE `__new_space_tool_permissions` RENAME TO `space_tool_permissions`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_space_tool` ON `space_tool_permissions` (`space_id`,`tool_id`);--> statement-breakpoint
CREATE INDEX `idx_space_tool_tool` ON `space_tool_permissions` (`tool_id`);--> statement-breakpoint
CREATE TABLE `__new_spaces` (
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
	CONSTRAINT "check_spaces_theme_json" CHECK(json_valid("__new_spaces"."theme_config") OR "__new_spaces"."theme_config" IS NULL),
	CONSTRAINT "check_spaces_ui_json" CHECK(json_valid("__new_spaces"."ui_config") OR "__new_spaces"."ui_config" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_spaces`("id", "account_id", "name", "slug", "description", "system_prompt", "model", "icon", "theme_config", "ui_config", "is_archived", "sort_order", "created_at", "updated_at") SELECT "id", "account_id", "name", "slug", "description", "system_prompt", "model", "icon", "theme_config", "ui_config", "is_archived", "sort_order", "created_at", "updated_at" FROM `spaces`;--> statement-breakpoint
DROP TABLE `spaces`;--> statement-breakpoint
ALTER TABLE `__new_spaces` RENAME TO `spaces`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_spaces_account_slug` ON `spaces` (`account_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_spaces_account_name` ON `spaces` (`account_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_spaces_account` ON `spaces` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_spaces_sort` ON `spaces` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_spaces_updated` ON `spaces` (`updated_at`);--> statement-breakpoint
ALTER TABLE `app_settings` RENAME COLUMN "active_mood_id" TO "active_space_id";--> statement-breakpoint
CREATE TABLE `__new_app_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`account_id` text NOT NULL,
	`active_space_id` text,
	`enable_worktrees` integer DEFAULT true NOT NULL,
	`show_tool_calls` integer DEFAULT true NOT NULL,
	`prevent_sleep_during_runs` integer DEFAULT false NOT NULL,
	`notify_on_run_complete` integer DEFAULT true NOT NULL,
	`notify_on_tool_approval` integer DEFAULT true NOT NULL,
	`commit_instructions` text DEFAULT '' NOT NULL,
	`pr_instructions` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_app_settings`("id", "account_id", "active_space_id", "enable_worktrees", "show_tool_calls", "prevent_sleep_during_runs", "notify_on_run_complete", "notify_on_tool_approval", "commit_instructions", "pr_instructions", "created_at", "updated_at") SELECT "id", "account_id", "active_space_id", "enable_worktrees", "show_tool_calls", "prevent_sleep_during_runs", "notify_on_run_complete", "notify_on_tool_approval", "commit_instructions", "pr_instructions", "created_at", "updated_at" FROM `app_settings`;--> statement-breakpoint
DROP TABLE `app_settings`;--> statement-breakpoint
ALTER TABLE `__new_app_settings` RENAME TO `app_settings`;--> statement-breakpoint
ALTER TABLE `chat_sessions` RENAME COLUMN "mood_id" TO "space_id";--> statement-breakpoint
CREATE TABLE `__new_chat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`initial_query` text,
	`provider_id` text,
	`model` text,
	`space_id` text,
	`system_prompt_snapshot` text,
	`provider_config_snapshot` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_chat_sessions_provider_config_json" CHECK(json_valid("__new_chat_sessions"."provider_config_snapshot") OR "__new_chat_sessions"."provider_config_snapshot" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_chat_sessions`("id", "title", "initial_query", "provider_id", "model", "space_id", "system_prompt_snapshot", "provider_config_snapshot", "created_at", "updated_at") SELECT "id", "title", "initial_query", "provider_id", "model", "space_id", "system_prompt_snapshot", "provider_config_snapshot", "created_at", "updated_at" FROM `chat_sessions`;--> statement-breakpoint
DROP TABLE `chat_sessions`;--> statement-breakpoint
ALTER TABLE `__new_chat_sessions` RENAME TO `chat_sessions`;--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_updated_at` ON `chat_sessions` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_created_at` ON `chat_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_space` ON `chat_sessions` (`space_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_provider` ON `chat_sessions` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_model` ON `chat_sessions` (`model`);--> statement-breakpoint
ALTER TABLE `runs` RENAME COLUMN "mood_id" TO "space_id";--> statement-breakpoint
CREATE TABLE `__new_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`workspace_id` text,
	`space_id` text,
	`provider_id` text NOT NULL,
	`model` text,
	`title` text,
	`goal` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`system_prompt` text,
	`config_snapshot` text,
	`tool_policy_snapshot` text,
	`started_at` integer,
	`ended_at` integer,
	`last_error` text,
	`stop_reason` text,
	`session_id` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "check_runs_config_snapshot_json" CHECK(json_valid("__new_runs"."config_snapshot") OR "__new_runs"."config_snapshot" IS NULL),
	CONSTRAINT "check_runs_tool_policy_snapshot_json" CHECK(json_valid("__new_runs"."tool_policy_snapshot") OR "__new_runs"."tool_policy_snapshot" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_runs`("id", "account_id", "workspace_id", "space_id", "provider_id", "model", "title", "goal", "status", "system_prompt", "config_snapshot", "tool_policy_snapshot", "started_at", "ended_at", "last_error", "stop_reason", "session_id", "is_archived", "created_at", "updated_at") SELECT "id", "account_id", "workspace_id", "space_id", "provider_id", "model", "title", "goal", "status", "system_prompt", "config_snapshot", "tool_policy_snapshot", "started_at", "ended_at", "last_error", "stop_reason", "session_id", "is_archived", "created_at", "updated_at" FROM `runs`;--> statement-breakpoint
DROP TABLE `runs`;--> statement-breakpoint
ALTER TABLE `__new_runs` RENAME TO `runs`;--> statement-breakpoint
CREATE INDEX `idx_runs_account_created` ON `runs` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_runs_account_status` ON `runs` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_runs_provider` ON `runs` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_workspace` ON `runs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_space` ON `runs` (`space_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_updated` ON `runs` (`updated_at`);