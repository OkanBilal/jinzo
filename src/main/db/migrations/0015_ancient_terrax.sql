CREATE TABLE `workspace_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`metadata` text,
	`ref_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_workspace_activity_metadata_json" CHECK(json_valid("workspace_activity"."metadata") OR "workspace_activity"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_activity_workspace` ON `workspace_activity` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_activity_type` ON `workspace_activity` (`type`);--> statement-breakpoint
CREATE INDEX `idx_workspace_activity_created` ON `workspace_activity` (`created_at`);