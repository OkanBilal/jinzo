CREATE TABLE `review_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`severity` text NOT NULL,
	`file` text NOT NULL,
	`line_start` integer,
	`line_end` integer,
	`message` text NOT NULL,
	`reason` text NOT NULL,
	`suggestion` text,
	`validated` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_review_findings_metadata_json" CHECK(json_valid("review_findings"."metadata") OR "review_findings"."metadata" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_review_findings_review` ON `review_findings` (`review_id`);--> statement-breakpoint
CREATE INDEX `idx_review_findings_severity` ON `review_findings` (`severity`);