CREATE TABLE `workspace_diffs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`run_id` text,
	`base_ref` text,
	`diff_text` text NOT NULL,
	`files_json` text,
	`stats_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_workspace_diffs_files_json" CHECK(json_valid("workspace_diffs"."files_json") OR "workspace_diffs"."files_json" IS NULL),
	CONSTRAINT "check_workspace_diffs_stats_json" CHECK(json_valid("workspace_diffs"."stats_json") OR "workspace_diffs"."stats_json" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_diffs_workspace` ON `workspace_diffs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_diffs_created` ON `workspace_diffs` (`created_at`);--> statement-breakpoint
-- Migrate existing data from run_diffs to workspace_diffs
INSERT INTO workspace_diffs (id, workspace_id, run_id, base_ref, diff_text, files_json, stats_json, created_at)
SELECT rd.id, r.workspace_id, rd.run_id, rd.base_ref, rd.diff_text, rd.files_json, rd.stats_json, rd.created_at
FROM run_diffs rd INNER JOIN runs r ON rd.run_id = r.id
WHERE r.workspace_id IS NOT NULL;
--> statement-breakpoint
DROP TABLE IF EXISTS `run_diffs`;
