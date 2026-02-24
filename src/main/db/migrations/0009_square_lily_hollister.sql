CREATE TABLE `run_usage` (
	`run_id` text PRIMARY KEY NOT NULL,
	`total_cost_micros` integer,
	`duration_ms` integer,
	`num_turns` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`provider_id` text,
	`model` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_run_usage_provider` ON `run_usage` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_run_usage_model` ON `run_usage` (`model`);--> statement-breakpoint
CREATE INDEX `idx_run_usage_created` ON `run_usage` (`created_at`);