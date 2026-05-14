import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AppSettingsState {
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  browserPanelOpen: boolean;
  onboardingCompleted: boolean;
  showSuggestions: boolean;
}

const initialState: AppSettingsState = {
  sidebarCollapsed: false,
  rightPanelOpen: false,
  browserPanelOpen: false,
  onboardingCompleted: false,
  showSuggestions: false,
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
  },
});

export const {
  setSidebarCollapsed,
  setBrowserPanelOpen,
  setRightPanelOpen,
  setOnboardingCompleted,
  setShowSuggestions,
} = appSettingsSlice.actions;
export default appSettingsSlice.reducer;
