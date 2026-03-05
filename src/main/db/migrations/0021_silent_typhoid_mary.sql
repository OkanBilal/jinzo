DROP TABLE `mcp_servers`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tools` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`schema` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "check_tools_schema_json" CHECK(json_valid("__new_tools"."schema") OR "__new_tools"."schema" IS NULL),
	CONSTRAINT "check_tools_metadata_json" CHECK(json_valid("__new_tools"."metadata") OR "__new_tools"."metadata" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_tools`("id", "source", "name", "description", "version", "is_enabled", "schema", "metadata", "created_at", "updated_at") SELECT "id", "source", "name", "description", "version", "is_enabled", "schema", "metadata", "created_at", "updated_at" FROM `tools`;--> statement-breakpoint
DROP TABLE `tools`;--> statement-breakpoint
ALTER TABLE `__new_tools` RENAME TO `tools`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_tools_source_name` ON `tools` (`source`,`name`);--> statement-breakpoint
CREATE INDEX `idx_tools_source` ON `tools` (`source`);--> statement-breakpoint
CREATE INDEX `idx_tools_enabled` ON `tools` (`is_enabled`);