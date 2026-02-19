import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { StructuredOutputSchema } from "../api/chatApi";

export const DEFAULT_MODEL = "gpt-oss:120b-cloud";

export interface ModelCapabilities {
  completion?: boolean;
  chat?: boolean;
  embeddings?: boolean;
  tools?: boolean;
  vision?: boolean;
  reasoning?: boolean;
}

export interface ChatState {
  selectedModel: string;
  thinkingLevel: "low" | "medium" | "high";
  thinkingEnabled: boolean;
  toolMode: "chat" | "rag" | "tool";
  modelCapabilities: ModelCapabilities | null;
  supportsThinking: boolean;
  structuredOutputEnabled: boolean;
  structuredOutputSchema: StructuredOutputSchema;
  webSearchEnabled: boolean;
}

const initialState: ChatState = {
  selectedModel: DEFAULT_MODEL,
  thinkingLevel: "medium",
  thinkingEnabled: true,
  toolMode: "chat",
  modelCapabilities: null,
  supportsThinking: false,
  structuredOutputEnabled: false,
  structuredOutputSchema: { properties: [] },
  webSearchEnabled: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload;
    },
    setThinkingLevel: (
      state,
      action: PayloadAction<"low" | "medium" | "high">,
    ) => {
      state.thinkingLevel = action.payload;
    },
    setThinkingEnabled: (state, action: PayloadAction<boolean>) => {
      state.thinkingEnabled = action.payload;
    },
    setToolMode: (state, action: PayloadAction<"chat" | "rag" | "tool">) => {
      state.toolMode = action.payload;
    },
    setModelCapabilities: (
      state,
      action: PayloadAction<{
        capabilities: ModelCapabilities | null;
        supportsThinking: boolean;
      }>,
    ) => {
      state.modelCapabilities = action.payload.capabilities;
      state.supportsThinking = action.payload.supportsThinking;
    },
    setStructuredOutputEnabled: (state, action: PayloadAction<boolean>) => {
      state.structuredOutputEnabled = action.payload;
    },
    setStructuredOutputSchema: (
      state,
      action: PayloadAction<StructuredOutputSchema>,
    ) => {
      state.structuredOutputSchema = action.payload;
    },
    setWebSearchEnabled: (state, action: PayloadAction<boolean>) => {
      state.webSearchEnabled = action.payload;
    },
  },
});

export const {
  setSelectedModel,
  setThinkingLevel,
  setThinkingEnabled,
  setToolMode,
  setModelCapabilities,
  setStructuredOutputEnabled,
  setStructuredOutputSchema,
  setWebSearchEnabled,
} = chatSlice.actions;
export default chatSlice.reducer;
