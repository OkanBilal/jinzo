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
  contextFiles: FileNode[];
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
  contextFiles: [],
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
    // Context files actions
    addContextFile: (state, action: PayloadAction<FileNode>) => {
      // Don't add duplicates
      if (!state.contextFiles.some(f => f.fullPath === action.payload.fullPath)) {
        state.contextFiles.push(action.payload);
      }
    },
    removeContextFile: (state, action: PayloadAction<string>) => {
      state.contextFiles = state.contextFiles.filter(f => f.fullPath !== action.payload);
    },
    clearContextFiles: (state) => {
      state.contextFiles = [];
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
  addContextFile,
  removeContextFile,
  clearContextFiles,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
