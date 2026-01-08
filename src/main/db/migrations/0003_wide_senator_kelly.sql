DROP INDEX `idx_app_states_user`;--> statement-breakpoint
DROP INDEX `uniq_app_states_user_app`;--> statement-breakpoint
ALTER TABLE `app_states` DROP COLUMN `user_id`;--> statement-breakpoint
ALTER TABLE `app_states` DROP COLUMN `icon_type`;--> statement-breakpoint
DROP INDEX `idx_connections_user`;--> statement-breakpoint
DROP INDEX `uniq_connections_user_provider`;--> statement-breakpoint
ALTER TABLE `connections` DROP COLUMN `user_id`;--> statement-breakpoint
ALTER TABLE `connection_resources` DROP COLUMN `description`;