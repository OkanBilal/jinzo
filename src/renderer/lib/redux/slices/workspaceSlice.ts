import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { FileNode, FileContentResponse } from "@/features/workspace/components/file-explorer";
import type { IssueWithEntity } from "@/lib/redux/api/entitiesApi";
import type { SignalWithEntity } from "@/lib/redux/api/signalsApi";

export interface ReviewTab {
  id: string;
  title: string;
  status: string;
}

export interface ContextIssue {
  entityId: string;
  title: string;
  body: string | null;
  provider: string;
  number: number | null;
  labels: string | null;
}

export interface ContextSignal {
  entityId: string;
  title: string;
  body: string | null;
  source: string;
  level: string;
  category: string;
  stackTrace: string | null;
  eventCount: number;
}

export interface ContextBrowserSelection {
  id: string;
  url: string;
  title: string;
  selector: string;
  tagName: string;
  text: string;
  outerHTML: string;
  styles: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  pageRect: { x: number; y: number; width: number; height: number };
  scroll: { x: number; y: number };
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  componentName?: string;
  sourceFile?: string;
  timestamp: string;
  screenshotPath?: string;
  screenshotDataUrl?: string;
  screenshotBase64?: string;
  surroundingScreenshotPath?: string;
  surroundingScreenshotDataUrl?: string;
  surroundingScreenshotBase64?: string;
  screenshotMimeType: string;
}

export interface WorkspaceState {
  activeWorkspaceId: string | null;
  activeWorkspaceIdByProvider: Record<string, string>;
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
  contextSignals: ContextSignal[];
  contextBrowserSelections: ContextBrowserSelection[];
  openIssueTabs: IssueWithEntity[];
  openSignalTabs: SignalWithEntity[];
  openNoteTabs: ReviewTab[];
  pendingGoal: string | null;
  pendingAutoExecute: boolean;
  pendingReviewTarget: {
    type: "uncommittedChanges" | "baseBranch" | "commit" | "custom";
    branch?: string;
    sha?: string;
    title?: string;
    instructions?: string;
  } | null;
}

const initialState: WorkspaceState = {
  activeWorkspaceId: null,
  activeWorkspaceIdByProvider: {},
  selectedModelByProvider: {},
  selectedProviderId: "claude_code",
  thinkingEnabled: false,
  selectedFile: null,
  selectedFileContent: null,
  isLoadingFileContent: false,
  fileContentError: null,
  activeTab: "editor",
  contextFiles: [],
  contextIssues: [],
  contextSignals: [],
  contextBrowserSelections: [],
  openIssueTabs: [],
  openSignalTabs: [],
  openNoteTabs: [],
  pendingGoal: null,
  pendingAutoExecute: false,
  pendingReviewTarget: null,
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setActiveWorkspaceId: (state, action: PayloadAction<string | null>) => {
      state.activeWorkspaceId = action.payload;
    },
    setActiveWorkspaceForProvider: (state, action: PayloadAction<{ providerId: string; workspaceId: string }>) => {
      state.activeWorkspaceIdByProvider[action.payload.providerId] = action.payload.workspaceId;
    },
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
    setActiveTab: (state, action: PayloadAction<"editor" | string>) => {
      state.activeTab = action.payload;
    },
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
    addContextIssue: (state, action: PayloadAction<ContextIssue>) => {
      if (!state.contextIssues.some(i => i.entityId === action.payload.entityId)) {
        state.contextIssues.push(action.payload);
      }
    },
    removeContextIssue: (state, action: PayloadAction<string>) => {
      state.contextIssues = state.contextIssues.filter(i => i.entityId !== action.payload);
    },
    clearContextIssues: (state) => {
      state.contextIssues = [];
    },
    addContextSignal: (state, action: PayloadAction<ContextSignal>) => {
      if (!state.contextSignals.some(s => s.entityId === action.payload.entityId)) {
        state.contextSignals.push(action.payload);
      }
    },
    removeContextSignal: (state, action: PayloadAction<string>) => {
      state.contextSignals = state.contextSignals.filter(s => s.entityId !== action.payload);
    },
    clearContextSignals: (state) => {
      state.contextSignals = [];
    },
    addContextBrowserSelection: (state, action: PayloadAction<ContextBrowserSelection>) => {
      if (!state.contextBrowserSelections.some(b => b.id === action.payload.id)) {
        state.contextBrowserSelections.push(action.payload);
      }
    },
    removeContextBrowserSelection: (state, action: PayloadAction<string>) => {
      state.contextBrowserSelections = state.contextBrowserSelections.filter(
        b => b.id !== action.payload,
      );
    },
    clearContextBrowserSelections: (state) => {
      state.contextBrowserSelections = [];
    },
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
    openSignalTab: (state, action: PayloadAction<SignalWithEntity>) => {
      const entityId = action.payload.signal.entityId;
      if (!state.openSignalTabs.some((t) => t.signal.entityId === entityId)) {
        state.openSignalTabs.push(action.payload);
      }
      state.activeTab = `signal:${entityId}`;
    },
    closeSignalTab: (state, action: PayloadAction<string>) => {
      const entityId = action.payload;
      state.openSignalTabs = state.openSignalTabs.filter(
        (t) => t.signal.entityId !== entityId,
      );
      if (state.activeTab === `signal:${entityId}`) {
        state.activeTab = "editor";
      }
    },
    clearSignalTabs: (state) => {
      state.openSignalTabs = [];
    },
    openNoteTab: (state, action: PayloadAction<ReviewTab>) => {
      if (!state.openNoteTabs.some((t) => t.id === action.payload.id)) {
        state.openNoteTabs.push(action.payload);
      }
      state.activeTab = `note:${action.payload.id}`;
    },
    closeNoteTab: (state, action: PayloadAction<string>) => {
      const noteId = action.payload;
      state.openNoteTabs = state.openNoteTabs.filter((t) => t.id !== noteId);
      if (state.activeTab === `note:${noteId}`) {
        state.activeTab = "editor";
      }
    },
    clearNoteTabs: (state) => {
      state.openNoteTabs = [];
    },
    openNewRunTab: (state) => {
      state.activeTab = "new-run";
    },
    closeNewRunTab: (state) => {
      if (state.activeTab === "new-run") {
        state.activeTab = "editor";
      }
    },
    setPendingGoal: (state, action: PayloadAction<string>) => {
      state.pendingGoal = action.payload;
    },
    setPendingAutoExecute: (state, action: PayloadAction<boolean>) => {
      state.pendingAutoExecute = action.payload;
    },
    clearPendingGoal: (state) => {
      state.pendingGoal = null;
      state.pendingAutoExecute = false;
    },
    setPendingReviewTarget: (state, action: PayloadAction<WorkspaceState["pendingReviewTarget"]>) => {
      state.pendingReviewTarget = action.payload;
    },
    clearPendingReviewTarget: (state) => {
      state.pendingReviewTarget = null;
    },
  },
});

export const {
  setActiveWorkspaceId,
  setActiveWorkspaceForProvider,
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
  addContextSignal,
  removeContextSignal,
  clearContextSignals,
  addContextBrowserSelection,
  removeContextBrowserSelection,
  clearContextBrowserSelections,
  openIssueTab,
  closeIssueTab,
  clearIssueTabs,
  openSignalTab,
  closeSignalTab,
  clearSignalTabs,
  openNoteTab,
  closeNoteTab,
  clearNoteTabs,
  openNewRunTab,
  closeNewRunTab,
  setPendingGoal,
  setPendingAutoExecute,
  clearPendingGoal,
  setPendingReviewTarget,
  clearPendingReviewTarget,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
