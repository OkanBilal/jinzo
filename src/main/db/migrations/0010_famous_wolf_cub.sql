CREATE TABLE `run_diffs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`base_ref` text,
	`diff_text` text NOT NULL,
	`files_json` text,
	`stats_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_run_diffs_files_json" CHECK(json_valid("run_diffs"."files_json") OR "run_diffs"."files_json" IS NULL),
	CONSTRAINT "check_run_diffs_stats_json" CHECK(json_valid("run_diffs"."stats_json") OR "run_diffs"."stats_json" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_run_diffs_run` ON `run_diffs` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_run_diffs_created` ON `run_diffs` (`created_at`);