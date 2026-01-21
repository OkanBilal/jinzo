import type { StructuredOutputSchema } from "../../../renderer/lib/chat";
import { DEFAULT_MODEL } from "../../../renderer/lib/config/chat";

export interface ChatConfig {
  temperature: number;
  top_p: number;
  topK: number;
  minScore: number;
  selectedModel: string;
  toolMode: "chat" | "rag" | "mcp";
  structuredOutputEnabled: boolean;
  structuredOutputSchema: StructuredOutputSchema;
}

const DEFAULT_CONFIG: ChatConfig = {
  temperature: 0.7,
  top_p: 0.9,
  topK: 10,
  minScore: 0.1,
  selectedModel: DEFAULT_MODEL,
  toolMode: "chat",
  structuredOutputEnabled: false,
  structuredOutputSchema: { properties: [] },
};

const chatConfig: ChatConfig = { ...DEFAULT_CONFIG };

export function getChatConfig(): ChatConfig {
  return { ...chatConfig };
}

export function updateChatConfig(payload: Partial<ChatConfig>): ChatConfig {
  if (typeof payload.temperature === "number") {
    chatConfig.temperature = Math.max(0, Math.min(2, payload.temperature));
  }

  if (typeof payload.top_p === "number") {
    chatConfig.top_p = Math.max(0, Math.min(1, payload.top_p));
  }

  if (typeof payload.topK === "number") {
    chatConfig.topK = Math.max(1, Math.min(100, payload.topK));
  }

  if (typeof payload.minScore === "number") {
    chatConfig.minScore = Math.max(0, Math.min(1, payload.minScore));
  }

  if (typeof payload.selectedModel === "string") {
    chatConfig.selectedModel = payload.selectedModel;
  }

  if (
    payload.toolMode === "chat" ||
    payload.toolMode === "rag" ||
    payload.toolMode === "mcp"
  ) {
    chatConfig.toolMode = payload.toolMode;
  }

  if (typeof payload.structuredOutputEnabled === "boolean") {
    chatConfig.structuredOutputEnabled = payload.structuredOutputEnabled;
  }

  if (
    payload.structuredOutputSchema &&
    Array.isArray(payload.structuredOutputSchema.properties)
  ) {
    chatConfig.structuredOutputSchema = payload.structuredOutputSchema;
  }

  return { ...chatConfig };
}
