ALTER TABLE `workspace_resources` RENAME TO `project_resources`;--> statement-breakpoint
ALTER TABLE `project_resources` RENAME COLUMN "workspace_id" TO "project_id";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `connection_resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project_resources`("id", "project_id", "resource_id", "created_at") SELECT "id", "project_id", "resource_id", "created_at" FROM `project_resources`;--> statement-breakpoint
DROP TABLE `project_resources`;--> statement-breakpoint
ALTER TABLE `__new_project_resources` RENAME TO `project_resources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_project_resources` ON `project_resources` (`project_id`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_project_resources_project` ON `project_resources` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_project_resources_resource` ON `project_resources` (`resource_id`);