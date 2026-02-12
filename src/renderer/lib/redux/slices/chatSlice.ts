import { createSlice, PayloadAction } from "@reduxjs/toolkit";

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
  webSearchEnabled: boolean;
}

const initialState: ChatState = {
  selectedModel: DEFAULT_MODEL,
  thinkingLevel: "medium",
  thinkingEnabled: true,
  toolMode: "chat",
  modelCapabilities: null,
  supportsThinking: false,
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
  setWebSearchEnabled,
} = chatSlice.actions;
export default chatSlice.reducer;
