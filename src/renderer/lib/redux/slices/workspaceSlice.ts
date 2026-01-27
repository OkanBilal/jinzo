import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface WorkspaceState {
  selectedModel: string;
  selectedProviderId: string;
  thinkingEnabled: boolean;
}

const initialState: WorkspaceState = {
  selectedModel: "",
  selectedProviderId: "copilot_cli",
  thinkingEnabled: false,
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setWorkspaceModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload;
    },
    setWorkspaceProvider: (state, action: PayloadAction<string>) => {
      state.selectedProviderId = action.payload;
      // Reset model when provider changes
      state.selectedModel = "";
    },
    setWorkspaceThinkingEnabled: (state, action: PayloadAction<boolean>) => {
      state.thinkingEnabled = action.payload;
    },
  },
});

export const {
  setWorkspaceModel,
  setWorkspaceProvider,
  setWorkspaceThinkingEnabled,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
