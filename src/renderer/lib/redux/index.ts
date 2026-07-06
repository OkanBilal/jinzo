import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

import { baseApi } from "./api/baseApi";
import appSettingsReducer from "./slices/appSettingsSlice";
import workspaceReducer from "./slices/workspaceSlice";
import backendsReducer from "./slices/backendsSlice";
import { onTransportChange } from "../transport";

const appSettingsPersistConfig = {
  key: "appSettings",
  storage,
  whitelist: [
    "sidebarCollapsed",
    "rightPanelOpen",
    "browserPanelOpen",
    "onboardingCompleted",
    "showSuggestions",
    "sidebarWidth",
    "rightPanelWidth",
    "browserPanelWidth",
    // Persist the panel width but NOT `documentViewerOpen`/`documentViewerDoc`:
    // the loaded document isn't persisted, so reopening to an empty panel on
    // restart would be confusing — start closed instead.
    "documentViewerWidth",
  ],
};

const workspacePersistConfig = {
  key: "workspace",
  storage,
  whitelist: [
    "selectedModelByProvider",
    "selectedProviderId",
    "thinkingEnabled",
    "activeWorkspaceIdByProvider",
  ],
};

const persistedAppSettingsReducer = persistReducer(
  appSettingsPersistConfig,
  appSettingsReducer,
);
const persistedWorkspaceReducer = persistReducer(
  workspacePersistConfig,
  workspaceReducer,
);

// Persist only the saved backend list; `activeBackendId` is intentionally left
// out so the app always starts on the local backend and the user reconnects.
const backendsPersistConfig = {
  key: "backends",
  storage,
  whitelist: ["saved"],
};
const persistedBackendsReducer = persistReducer(
  backendsPersistConfig,
  backendsReducer,
);

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    appSettings: persistedAppSettingsReducer,
    workspace: persistedWorkspaceReducer,
    backends: persistedBackendsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Dev-only deep-state checks walk the whole store on every dispatch; the
      // RTK Query cache (`api`) is by far the largest subtree and RTKQ already
      // enforces immutability internally. Excluding it keeps the startup
      // dispatch storm from monopolizing the main thread in dev.
      immutableCheck: {
        ignoredPaths: ["api"],
      },
      serializableCheck: {
        ignoredActions: [
          "api/executeQuery/pending",
          "api/executeQuery/fulfilled",
          "api/executeMutation/pending",
          "api/executeMutation/fulfilled",
          "persist/PERSIST",
          "persist/REHYDRATE",
        ],
        ignoredPaths: ["api.queries", "api.mutations"],
      },
    }).concat(baseApi.middleware),
  devTools: process.env.NODE_ENV !== "production",
});

// When the active backend transport changes (local ↔ remote), clear cached
// query data so the UI refetches everything from the newly-active backend.
onTransportChange(() => {
  store.dispatch(baseApi.util.resetApiState());
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
