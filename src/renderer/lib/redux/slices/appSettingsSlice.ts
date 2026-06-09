import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  SIDEBAR_WIDTH_DEFAULT,
  PANEL_WIDTH_DEFAULT,
  BROWSER_PANEL_WIDTH_DEFAULT,
  DOC_VIEWER_PANEL_WIDTH_DEFAULT,
} from "@/lib/layout";
import type { DocType } from "@/lib/document-viewer";

/** The document currently shown in the document viewer panel. */
export interface DocumentViewerDoc {
  path: string;
  fileName: string;
  docType: DocType;
}

export interface AppSettingsState {
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  browserPanelOpen: boolean;
  onboardingCompleted: boolean;
  showSuggestions: boolean;
  /** Sidebar width in pixels. Mirrored onto `--sidebar-width`. */
  sidebarWidth: number;
  /** Right panel width in pixels. Mirrored onto `--panel-width`. */
  rightPanelWidth: number;
  /** Embedded browser panel width in pixels. Mirrored onto `--browser-panel-width`. */
  browserPanelWidth: number;
  /** Whether the in-app document viewer panel is open. */
  documentViewerOpen: boolean;
  /** Document viewer panel width in pixels. Mirrored onto `--doc-viewer-panel-width`. */
  documentViewerWidth: number;
  /** The document currently loaded in the viewer (not persisted — avoids stale auto-reopen). */
  documentViewerDoc: DocumentViewerDoc | null;
}

const initialState: AppSettingsState = {
  sidebarCollapsed: false,
  rightPanelOpen: false,
  browserPanelOpen: false,
  onboardingCompleted: false,
  showSuggestions: false,
  sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
  rightPanelWidth: PANEL_WIDTH_DEFAULT,
  browserPanelWidth: BROWSER_PANEL_WIDTH_DEFAULT,
  documentViewerOpen: false,
  documentViewerWidth: DOC_VIEWER_PANEL_WIDTH_DEFAULT,
  documentViewerDoc: null,
};

const appSettingsSlice = createSlice({
  name: "appSettings",
  initialState,
  reducers: {
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    setBrowserPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.browserPanelOpen = action.payload;
    },
    setRightPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.rightPanelOpen = action.payload;
    },
    setOnboardingCompleted: (state, action: PayloadAction<boolean>) => {
      state.onboardingCompleted = action.payload;
    },
    setShowSuggestions: (state, action: PayloadAction<boolean>) => {
      state.showSuggestions = action.payload;
    },
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = action.payload;
    },
    setRightPanelWidth: (state, action: PayloadAction<number>) => {
      state.rightPanelWidth = action.payload;
    },
    setBrowserPanelWidth: (state, action: PayloadAction<number>) => {
      state.browserPanelWidth = action.payload;
    },
    setDocumentViewerOpen: (state, action: PayloadAction<boolean>) => {
      state.documentViewerOpen = action.payload;
    },
    setDocumentViewerPanelWidth: (state, action: PayloadAction<number>) => {
      state.documentViewerWidth = action.payload;
    },
    setDocumentViewerDoc: (
      state,
      action: PayloadAction<DocumentViewerDoc | null>,
    ) => {
      state.documentViewerDoc = action.payload;
    },
  },
});

export const {
  setSidebarCollapsed,
  setBrowserPanelOpen,
  setRightPanelOpen,
  setOnboardingCompleted,
  setShowSuggestions,
  setSidebarWidth,
  setRightPanelWidth,
  setBrowserPanelWidth,
  setDocumentViewerOpen,
  setDocumentViewerPanelWidth,
  setDocumentViewerDoc,
} = appSettingsSlice.actions;
export default appSettingsSlice.reducer;
