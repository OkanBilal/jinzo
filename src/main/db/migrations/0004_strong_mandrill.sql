CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`error` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`duration_ms` integer,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_automation_runs_result_json" CHECK(json_valid("automation_runs"."result") OR "automation_runs"."result" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_automation_runs_automation` ON `automation_runs` (`automation_id`);--> statement-breakpoint
CREATE INDEX `idx_automation_runs_status` ON `automation_runs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_automation_runs_started` ON `automation_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `automations` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`action` text NOT NULL,
	`interval_minutes` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`config` text,
	`last_run_at` integer,
	`next_run_at` integer,
	`last_error` text,
	`consecutive_errors` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_automations_config_json" CHECK(json_valid("automations"."config") OR "automations"."config" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_automations_account` ON `automations` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_automations_kind` ON `automations` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_automations_active` ON `automations` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_automations_next_run` ON `automations` (`next_run_at`);