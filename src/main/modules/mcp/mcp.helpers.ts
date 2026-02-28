import type { OllamaToolDefinition } from "./mcp.dto";

// ─────────────────────────────────────────────────────────────
// Tool Type Helpers
// ─────────────────────────────────────────────────────────────
export function isSyncTool(name: string): boolean {
  return name === "trigger_entity_sync" || name === "trigger_feed_sync";
}

export function isSpaceTool(name: string): boolean {
  return name === "switch_to_journal_space" || name === "switch_to_chat_space";
}

export function isJournalTool(name: string): boolean {
  return name === "append_to_journal";
}

export function isEntityTool(name: string): boolean {
  return (
    name === "entity_list" ||
    name === "entity_search" ||
    name === "feed_list" ||
    name === "feed_search"
  );
}
