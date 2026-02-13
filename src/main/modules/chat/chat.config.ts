import type { ChatConfig } from "./chat.dto";


//TODO: MOVE DB
// ─────────────────────────────────────────────────────────────
// Default Config
// ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: ChatConfig = {
  temperature: 0.7,
  top_p: 0.9,
  topK: 10,
  minScore: 0.1,
  stop: [],
  selectedModel: "gpt-oss:120b-cloud",
  toolMode: "chat",
  structuredOutputEnabled: false,
  structuredOutputSchema: { properties: [] },
  webSearchEnabled: false,
};

const chatConfig: ChatConfig = { ...DEFAULT_CONFIG };

// ─────────────────────────────────────────────────────────────
// Config Functions
// ─────────────────────────────────────────────────────────────
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

  if (Array.isArray(payload.stop)) {
    chatConfig.stop = payload.stop.filter((s) => typeof s === "string");
  }

  if (typeof payload.selectedModel === "string") {
    chatConfig.selectedModel = payload.selectedModel;
  }

  if (
    payload.toolMode === "chat" ||
    payload.toolMode === "rag" ||
    payload.toolMode === "tool"
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

  if (typeof payload.webSearchEnabled === "boolean") {
    chatConfig.webSearchEnabled = payload.webSearchEnabled;
  }

  return { ...chatConfig };
}
