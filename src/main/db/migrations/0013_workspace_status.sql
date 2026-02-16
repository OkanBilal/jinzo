ALTER TABLE `workspaces` ADD `status` text DEFAULT 'todo' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_workspaces_status` ON `workspaces` (`status`);
