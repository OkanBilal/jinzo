CREATE TABLE `document_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_id` text NOT NULL,
	`title` text,
	`body` text,
	`word_count` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_doc_revisions_entity` ON `document_revisions` (`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_doc_revisions_created` ON `document_revisions` (`created_at`);