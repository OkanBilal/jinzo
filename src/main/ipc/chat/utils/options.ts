import type { ChatOptions } from "../../../../renderer/lib/chat";
import type { ChatConfig } from "../config";

export interface MergedChatOptions {
  temperature: number;
  top_p: number;
  topK: number;
  minScore: number;
  toolMode: "chat" | "rag" | "mcp";
  noCache?: boolean;
  includeMetadata?: boolean;
  skipUserSave?: boolean;
  sourceFilter?: string[];
  itemTypeFilter?: string[];
  prioritizeSources?: string[];
}

export function mergeOptionsWithConfig(
  options: ChatOptions,
  config: ChatConfig
): MergedChatOptions {
  return {
    temperature: options.temperature ?? config.temperature,
    top_p: options.top_p ?? config.top_p,
    topK: options.topK ?? config.topK,
    minScore: options.minScore ?? config.minScore,
    toolMode: ((options as any).toolMode ?? config.toolMode) as "chat" | "rag" | "mcp",
    noCache: options.noCache,
    includeMetadata: options.includeMetadata,
    skipUserSave: options.skipUserSave,
    sourceFilter: options.sourceFilter,
    itemTypeFilter: options.itemTypeFilter,
    prioritizeSources: options.prioritizeSources,
  };
}
