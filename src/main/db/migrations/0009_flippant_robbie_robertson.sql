CREATE TABLE `cues` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_workspace_id` text,
	`kind` text DEFAULT 'note' NOT NULL,
	`status` text DEFAULT 'inbox' NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_cues_metadata_json" CHECK(json_valid("cues"."metadata") OR "cues"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_cues_account` ON `cues` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_cues_project_status` ON `cues` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_cues_project_updated` ON `cues` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_cues_source_workspace` ON `cues` (`source_workspace_id`);