import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AppSettingsState {
  isDarkMode: boolean;
  sidebarCollapsed: boolean;
  onboardingCompleted: boolean;
}

const initialState: AppSettingsState = {
  isDarkMode: false,
  sidebarCollapsed: false,
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
    setOnboardingCompleted: (state, action: PayloadAction<boolean>) => {
      state.onboardingCompleted = action.payload;
    },
  },
});

export const { setDarkMode, setSidebarCollapsed, setOnboardingCompleted } =
  appSettingsSlice.actions;
export default appSettingsSlice.reducer;
