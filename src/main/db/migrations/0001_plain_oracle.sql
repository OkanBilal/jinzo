CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`root_path` text NOT NULL,
	`workspaces_path` text,
	`branches` text,
	`remote_origin` text NOT NULL,
	`default_branch` text,
	`setup_script` text,
	`run_script` text,
	`archive_script` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_projects_branches_json" CHECK(json_valid("projects"."branches") OR "projects"."branches" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_projects_account_origin` ON `projects` (`account_id`,`remote_origin`);--> statement-breakpoint
CREATE INDEX `idx_projects_account` ON `projects` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_remote_origin` ON `projects` (`remote_origin`);--> statement-breakpoint
CREATE INDEX `idx_projects_updated` ON `projects` (`updated_at`);--> statement-breakpoint
ALTER TABLE `workspaces` ADD `project_id` text REFERENCES projects(id);--> statement-breakpoint
CREATE INDEX `idx_workspaces_project` ON `workspaces` (`project_id`);