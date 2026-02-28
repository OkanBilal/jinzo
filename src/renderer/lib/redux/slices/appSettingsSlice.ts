import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AppSettingsState {
  isDarkMode: boolean;
  sidebarCollapsed: boolean;
  fontSize: "small" | "medium" | "large";
  journalSpace: boolean;
  onboardingCompleted: boolean;
}

const initialState: AppSettingsState = {
  isDarkMode: false,
  sidebarCollapsed: false,
  fontSize: "medium",
  journalSpace: false,
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
    setFontSize: (
      state,
      action: PayloadAction<"small" | "medium" | "large">
    ) => {
      state.fontSize = action.payload;
    },
    setJournalSpace: (state, action: PayloadAction<boolean>) => {
      state.journalSpace = action.payload;
    },
    setOnboardingCompleted: (state, action: PayloadAction<boolean>) => {
      state.onboardingCompleted = action.payload;
    },
  },
});

export const { setDarkMode, setSidebarCollapsed, setFontSize, setJournalSpace, setOnboardingCompleted } =
  appSettingsSlice.actions;
export default appSettingsSlice.reducer;
