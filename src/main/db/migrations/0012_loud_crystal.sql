CREATE TABLE `run_turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`turn_index` integer NOT NULL,
	`prompt_content` text,
	`response_content` text,
	`started_at` integer,
	`ended_at` integer,
	`elapsed_ms` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_read_tokens` integer,
	`cache_write_tokens` integer,
	`cost_micros` integer,
	`model` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_run_turns_metadata_json" CHECK(json_valid("run_turns"."metadata") OR "run_turns"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_run_turns_run` ON `run_turns` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_run_turns_run_index` ON `run_turns` (`run_id`,`turn_index`);