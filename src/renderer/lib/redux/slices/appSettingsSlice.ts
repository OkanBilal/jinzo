import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AppSettingsState {
  isDarkMode: boolean;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  browserPanelOpen: boolean;
  onboardingCompleted: boolean;
}

const initialState: AppSettingsState = {
  isDarkMode: false,
  sidebarCollapsed: false,
  rightPanelOpen: false,
  browserPanelOpen: false,
  onboardingCompleted: false,
};

const appSettingsSlice = createSlice({
  name: "appSettings",
  initialState,
  reducers: {
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.isDarkMode = action.payload;
    },
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
  },
});

export const {
  setDarkMode,
  setSidebarCollapsed,
  setBrowserPanelOpen,
  setRightPanelOpen,
  setOnboardingCompleted,
} = appSettingsSlice.actions;
export default appSettingsSlice.reducer;
