CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`title` text NOT NULL,
	`summary` text,
	`status` text DEFAULT 'open' NOT NULL,
	`run_id` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_reviews_metadata_json" CHECK(json_valid("reviews"."metadata") OR "reviews"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_workspace` ON `reviews` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_status` ON `reviews` (`status`);--> statement-breakpoint
CREATE INDEX `idx_reviews_updated` ON `reviews` (`updated_at`);