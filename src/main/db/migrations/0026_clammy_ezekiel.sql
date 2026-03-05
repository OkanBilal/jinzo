DROP TABLE `tools`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tool_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`run_id` text,
	`provider_id` text,
	`tool_call_id` text,
	`parent_tool_call_id` text,
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
	CONSTRAINT "check_tool_calls_input_json" CHECK(json_valid("__new_tool_calls"."input") OR "__new_tool_calls"."input" IS NULL),
	CONSTRAINT "check_tool_calls_output_json" CHECK(json_valid("__new_tool_calls"."output") OR "__new_tool_calls"."output" IS NULL),
	CONSTRAINT "check_tool_calls_metadata_json" CHECK(json_valid("__new_tool_calls"."metadata") OR "__new_tool_calls"."metadata" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_tool_calls`("id", "account_id", "run_id", "provider_id", "tool_call_id", "parent_tool_call_id", "tool_name", "status", "input", "output", "error", "started_at", "ended_at", "latency_ms", "cost_micros", "metadata", "created_at") SELECT "id", "account_id", "run_id", "provider_id", "tool_call_id", "parent_tool_call_id", "tool_name", "status", "input", "output", "error", "started_at", "ended_at", "latency_ms", "cost_micros", "metadata", "created_at" FROM `tool_calls`;--> statement-breakpoint
DROP TABLE `tool_calls`;--> statement-breakpoint
ALTER TABLE `__new_tool_calls` RENAME TO `tool_calls`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_tool_calls_account_created` ON `tool_calls` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tool_calls_run` ON `tool_calls` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_calls_provider` ON `tool_calls` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_calls_status` ON `tool_calls` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tool_calls_run_toolcallid` ON `tool_calls` (`run_id`,`tool_call_id`);