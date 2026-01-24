ALTER TABLE `tool_calls` ADD `tool_call_id` text;--> statement-breakpoint
ALTER TABLE `tool_calls` ADD `parent_tool_call_id` text;--> statement-breakpoint
CREATE INDEX `idx_tool_calls_run_toolcallid` ON `tool_calls` (`run_id`,`tool_call_id`);