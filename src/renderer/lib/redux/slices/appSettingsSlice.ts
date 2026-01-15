import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AppSettingsState {
  isDarkMode: boolean;
  sidebarCollapsed: boolean;
  fontSize: "small" | "medium" | "large";
}

const initialState: AppSettingsState = {
  isDarkMode: false,
  sidebarCollapsed: false,
  fontSize: "medium",
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
  },
});

export const { setDarkMode, setSidebarCollapsed, setFontSize } =
  appSettingsSlice.actions;
export default appSettingsSlice.reducer;
