CREATE TABLE `signals` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`level` text DEFAULT 'error' NOT NULL,
	`category` text DEFAULT 'bug' NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`event_count` integer DEFAULT 1 NOT NULL,
	`affected_users` integer,
	`first_seen_at` integer,
	`last_seen_at` integer,
	`stack_trace` text,
	`file` text,
	`function` text,
	`line` integer,
	`assignee` text,
	`labels` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`project_id` text,
	`resolved_at` integer,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "check_signals_labels_json" CHECK(json_valid("signals"."labels") OR "signals"."labels" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_signals_source` ON `signals` (`source`);--> statement-breakpoint
CREATE INDEX `idx_signals_level` ON `signals` (`level`);--> statement-breakpoint
CREATE INDEX `idx_signals_category` ON `signals` (`category`);--> statement-breakpoint
CREATE INDEX `idx_signals_state` ON `signals` (`state`);--> statement-breakpoint
CREATE INDEX `idx_signals_project` ON `signals` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_signals_last_seen` ON `signals` (`last_seen_at`);