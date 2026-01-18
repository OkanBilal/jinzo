import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AppSettingsState {
  isDarkMode: boolean;
  sidebarCollapsed: boolean;
  fontSize: "small" | "medium" | "large";
  journalMood: boolean;
}

const initialState: AppSettingsState = {
  isDarkMode: false,
  sidebarCollapsed: false,
  fontSize: "medium",
  journalMood: false,
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
    setJournalMood: (state, action: PayloadAction<boolean>) => {
      state.journalMood = action.payload;
    },
  },
});

export const { setDarkMode, setSidebarCollapsed, setFontSize, setJournalMood } =
  appSettingsSlice.actions;
export default appSettingsSlice.reducer;
