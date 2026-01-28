import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { FileNode, FileContentResponse } from "@/features/file-explorer";

export interface WorkspaceState {
  selectedModel: string;
  selectedProviderId: string;
  thinkingEnabled: boolean;
  selectedFile: FileNode | null;
  selectedFileContent: FileContentResponse | null;
  isLoadingFileContent: boolean;
  fileContentError: string | null;
  activeTab: "editor" | string;
}

const initialState: WorkspaceState = {
  selectedModel: "",
  selectedProviderId: "copilot_cli",
  thinkingEnabled: false,
  selectedFile: null,
  selectedFileContent: null,
  isLoadingFileContent: false,
  fileContentError: null,
  activeTab: "editor",
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
      state.selectedModel = "";
    },
    setWorkspaceThinkingEnabled: (state, action: PayloadAction<boolean>) => {
      state.thinkingEnabled = action.payload;
    },
    setSelectedFile: (state, action: PayloadAction<FileNode | null>) => {
      state.selectedFile = action.payload;
      if (action.payload) {
        state.selectedFileContent = null;
        state.fileContentError = null;
      }
    },
    setSelectedFileContent: (state, action: PayloadAction<FileContentResponse | null>) => {
      state.selectedFileContent = action.payload;
      state.isLoadingFileContent = false;
    },
    setFileContentLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingFileContent = action.payload;
    },
    setFileContentError: (state, action: PayloadAction<string | null>) => {
      state.fileContentError = action.payload;
      state.isLoadingFileContent = false;
    },
    clearSelectedFile: (state) => {
      state.selectedFile = null;
      state.selectedFileContent = null;
      state.fileContentError = null;
      state.isLoadingFileContent = false;
    },
    // Tab actions
    setActiveTab: (state, action: PayloadAction<"editor" | string>) => {
      state.activeTab = action.payload;
    },
  },
});

export const {
  setWorkspaceModel,
  setWorkspaceProvider,
  setWorkspaceThinkingEnabled,
  setSelectedFile,
  setSelectedFileContent,
  setFileContentLoading,
  setFileContentError,
  clearSelectedFile,
  setActiveTab,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
