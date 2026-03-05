DROP INDEX `idx_resources_last_ingest`;--> statement-breakpoint
ALTER TABLE `connection_resources` DROP COLUMN `last_ingest_at`;