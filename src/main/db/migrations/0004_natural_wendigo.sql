CREATE TABLE `workspace_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `connection_resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_workspace_resources` ON `workspace_resources` (`workspace_id`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_resources_workspace` ON `workspace_resources` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_resources_resource` ON `workspace_resources` (`resource_id`);