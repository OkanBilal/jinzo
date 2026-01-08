CREATE TABLE `accounts` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`display_name` text,
	`email` text,
	`company` text,
	`job_title` text,
	`timezone` text,
	`locale` text,
	`website` text,
	`avatar_url` text,
	`bio` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_email` ON `accounts` (`email`);--> statement-breakpoint
CREATE INDEX `idx_accounts_display_name` ON `accounts` (`display_name`);