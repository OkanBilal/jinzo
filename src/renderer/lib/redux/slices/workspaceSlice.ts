import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { FileNode, FileContentResponse } from "@/features/file-explorer";
import type { IssueWithEntity } from "@/lib/redux/api/entitiesApi";

export interface ContextIssue {
  entityId: string;
  title: string;
  body: string | null;
  provider: string;
  number: number | null;
}

export interface WorkspaceState {
  selectedModelByProvider: Record<string, string>;
  selectedProviderId: string;
  thinkingEnabled: boolean;
  selectedFile: FileNode | null;
  selectedFileContent: FileContentResponse | null;
  isLoadingFileContent: boolean;
  fileContentError: string | null;
  activeTab: "editor" | string;
  contextFiles: FileNode[];
  contextIssues: ContextIssue[];
  openIssueTabs: IssueWithEntity[];
}

const initialState: WorkspaceState = {
  selectedModelByProvider: {},
  selectedProviderId: "copilot_cli",
  thinkingEnabled: false,
  selectedFile: null,
  selectedFileContent: null,
  isLoadingFileContent: false,
  fileContentError: null,
  activeTab: "editor",
  contextFiles: [],
  contextIssues: [],
  openIssueTabs: [],
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setWorkspaceModel: (state, action: PayloadAction<{ providerId: string; model: string }>) => {
      state.selectedModelByProvider[action.payload.providerId] = action.payload.model;
    },
    setWorkspaceProvider: (state, action: PayloadAction<string>) => {
      state.selectedProviderId = action.payload;
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
    // Context issues actions
    addContextIssue: (state, action: PayloadAction<ContextIssue>) => {
      // Replace existing issue - only 1 allowed
      state.contextIssues = [action.payload];
    },
    removeContextIssue: (state, action: PayloadAction<string>) => {
      state.contextIssues = state.contextIssues.filter(i => i.entityId !== action.payload);
    },
    clearContextIssues: (state) => {
      state.contextIssues = [];
    },
    // Issue tab actions
    openIssueTab: (state, action: PayloadAction<IssueWithEntity>) => {
      const entityId = action.payload.issue.entityId;
      if (!state.openIssueTabs.some((t) => t.issue.entityId === entityId)) {
        state.openIssueTabs.push(action.payload);
      }
      state.activeTab = `issue:${entityId}`;
    },
    closeIssueTab: (state, action: PayloadAction<string>) => {
      const entityId = action.payload;
      state.openIssueTabs = state.openIssueTabs.filter(
        (t) => t.issue.entityId !== entityId,
      );
      if (state.activeTab === `issue:${entityId}`) {
        state.activeTab = "editor";
      }
    },
    clearIssueTabs: (state) => {
      state.openIssueTabs = [];
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
  addContextIssue,
  removeContextIssue,
  clearContextIssues,
  openIssueTab,
  closeIssueTab,
  clearIssueTabs,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
