CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`transport` text NOT NULL,
	`endpoint` text,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_mcp_servers_metadata_json" CHECK(json_valid("mcp_servers"."metadata") OR "mcp_servers"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_account` ON `mcp_servers` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_status` ON `mcp_servers` (`status`);--> statement-breakpoint
CREATE TABLE `mood_tool_permissions` (
	`mood_id` text NOT NULL,
	`tool_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`policy` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mood_id`) REFERENCES `moods`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_mood_tool_policy_json" CHECK(json_valid("mood_tool_permissions"."policy") OR "mood_tool_permissions"."policy" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_mood_tool` ON `mood_tool_permissions` (`mood_id`,`tool_id`);--> statement-breakpoint
CREATE INDEX `idx_mood_tool_tool` ON `mood_tool_permissions` (`tool_id`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`config` text,
	`capabilities` text,
	`default_model` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "check_providers_config_json" CHECK(json_valid("providers"."config") OR "providers"."config" IS NULL),
	CONSTRAINT "check_providers_capabilities_json" CHECK(json_valid("providers"."capabilities") OR "providers"."capabilities" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_providers_kind` ON `providers` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_providers_enabled` ON `providers` (`is_enabled`);--> statement-breakpoint
CREATE INDEX `idx_providers_updated` ON `providers` (`updated_at`);--> statement-breakpoint
CREATE TABLE `run_artifacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`path` text,
	`content` text,
	`blob_data` blob,
	`entity_id` text,
	`content_hash` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_run_artifacts_metadata_json" CHECK(json_valid("run_artifacts"."metadata") OR "run_artifacts"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_run_artifacts_run` ON `run_artifacts` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_run_artifacts_kind` ON `run_artifacts` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_run_artifacts_path` ON `run_artifacts` (`path`);--> statement-breakpoint
CREATE INDEX `idx_run_artifacts_entity` ON `run_artifacts` (`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_run_artifacts_hash` ON `run_artifacts` (`content_hash`);--> statement-breakpoint
CREATE TABLE `run_commands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`cwd` text,
	`command` text NOT NULL,
	`env_keys` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`exit_code` integer,
	`stdout` text,
	`stderr` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_run_commands_env_keys_json" CHECK(json_valid("run_commands"."env_keys") OR "run_commands"."env_keys" IS NULL),
	CONSTRAINT "check_run_commands_metadata_json" CHECK(json_valid("run_commands"."metadata") OR "run_commands"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_run_commands_run` ON `run_commands` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_run_commands_status` ON `run_commands` (`status`);--> statement-breakpoint
CREATE INDEX `idx_run_commands_created` ON `run_commands` (`created_at`);--> statement-breakpoint
CREATE TABLE `run_context` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref` text,
	`content` text,
	`entity_id` text,
	`content_hash` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_run_context_metadata_json" CHECK(json_valid("run_context"."metadata") OR "run_context"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_run_context_run` ON `run_context` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_run_context_kind` ON `run_context` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_run_context_entity` ON `run_context` (`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_run_context_hash` ON `run_context` (`content_hash`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`workspace_id` text,
	`mood_id` text,
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
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`mood_id`) REFERENCES `moods`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "check_runs_config_snapshot_json" CHECK(json_valid("runs"."config_snapshot") OR "runs"."config_snapshot" IS NULL),
	CONSTRAINT "check_runs_tool_policy_snapshot_json" CHECK(json_valid("runs"."tool_policy_snapshot") OR "runs"."tool_policy_snapshot" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_runs_account_created` ON `runs` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_runs_account_status` ON `runs` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_runs_provider` ON `runs` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_workspace` ON `runs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_mood` ON `runs` (`mood_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_updated` ON `runs` (`updated_at`);--> statement-breakpoint
CREATE TABLE `tool_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`run_id` text,
	`provider_id` text,
	`tool_id` text,
	`tool_name` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`input` text,
	`output` text,
	`error` text,
	`started_at` integer,
	`ended_at` integer,
	`latency_ms` integer,
	`cost_micros` integer,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_tool_calls_input_json" CHECK(json_valid("tool_calls"."input") OR "tool_calls"."input" IS NULL),
	CONSTRAINT "check_tool_calls_output_json" CHECK(json_valid("tool_calls"."output") OR "tool_calls"."output" IS NULL),
	CONSTRAINT "check_tool_calls_metadata_json" CHECK(json_valid("tool_calls"."metadata") OR "tool_calls"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_tool_calls_account_created` ON `tool_calls` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tool_calls_run` ON `tool_calls` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_calls_provider` ON `tool_calls` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_calls_tool` ON `tool_calls` (`tool_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_calls_status` ON `tool_calls` (`status`);--> statement-breakpoint
CREATE TABLE `tools` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`schema` text,
	`mcp_server_id` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mcp_server_id`) REFERENCES `mcp_servers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_tools_schema_json" CHECK(json_valid("tools"."schema") OR "tools"."schema" IS NULL),
	CONSTRAINT "check_tools_metadata_json" CHECK(json_valid("tools"."metadata") OR "tools"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_tools_source_name` ON `tools` (`source`,`name`);--> statement-breakpoint
CREATE INDEX `idx_tools_source` ON `tools` (`source`);--> statement-breakpoint
CREATE INDEX `idx_tools_enabled` ON `tools` (`is_enabled`);--> statement-breakpoint
CREATE INDEX `idx_tools_mcp_server` ON `tools` (`mcp_server_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`root_path` text NOT NULL,
	`repo_url` text,
	`default_branch` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_workspaces_metadata_json" CHECK(json_valid("workspaces"."metadata") OR "workspaces"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_account` ON `workspaces` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_workspaces_account_root` ON `workspaces` (`account_id`,`root_path`);--> statement-breakpoint
CREATE INDEX `idx_workspaces_updated` ON `workspaces` (`updated_at`);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `provider_id` text REFERENCES providers(id);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `trace_id` text;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `latency_ms` integer;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `input_tokens` integer;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `output_tokens` integer;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `tool_call_group_id` text;--> statement-breakpoint
CREATE INDEX `idx_chat_messages_provider` ON `chat_messages` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_model` ON `chat_messages` (`model`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_trace` ON `chat_messages` (`trace_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`initial_query` text,
	`provider_id` text,
	`model` text,
	`mood_id` text,
	`system_prompt_snapshot` text,
	`provider_config_snapshot` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`mood_id`) REFERENCES `moods`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_chat_sessions_provider_config_json" CHECK(json_valid("__new_chat_sessions"."provider_config_snapshot") OR "__new_chat_sessions"."provider_config_snapshot" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_chat_sessions`("id", "title", "initial_query", "provider_id", "model", "mood_id", "system_prompt_snapshot", "provider_config_snapshot", "created_at", "updated_at") SELECT "id", "title", "initial_query", NULL, "model", "mood_id", "system_prompt_snapshot", NULL, "created_at", "updated_at" FROM `chat_sessions`;--> statement-breakpoint
DROP TABLE `chat_sessions`;--> statement-breakpoint
ALTER TABLE `__new_chat_sessions` RENAME TO `chat_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_updated_at` ON `chat_sessions` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_created_at` ON `chat_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_mood` ON `chat_sessions` (`mood_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_provider` ON `chat_sessions` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_model` ON `chat_sessions` (`model`);