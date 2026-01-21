import { ENTITY_TOOLS, MOOD_TOOLS, SYNC_TOOLS } from "./utils/tools";

export function getAllTools() {
  return [...ENTITY_TOOLS, ...SYNC_TOOLS, ...MOOD_TOOLS];
}

export function formatToolsForResponse(tools: typeof ENTITY_TOOLS) {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));
}

export function isSyncTool(name: string): boolean {
  return name === "trigger_entity_sync" || name === "trigger_feed_sync";
}

export function isMoodTool(name: string): boolean {
  return name === "switch_to_journal_mood" || name === "switch_to_chat_mood";
}
