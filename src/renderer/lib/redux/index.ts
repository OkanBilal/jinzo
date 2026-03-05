import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

import { baseApi } from "./api/baseApi";
import chatReducer from "./slices/chatSlice";
import spaceReducer from "./slices/spaceSlice";
import appSettingsReducer from "./slices/appSettingsSlice";
import workspaceReducer from "./slices/workspaceSlice";

const chatPersistConfig = {
  key: "chat",
  storage,
  whitelist: ["selectedModel", "thinkingLevel", "thinkingEnabled", "toolMode"],
};

const spacePersistConfig = {
  key: "space",
  storage,
  whitelist: ["activeSpaceId"],
};

const appSettingsPersistConfig = {
  key: "appSettings",
  storage,
  whitelist: ["isDarkMode", "sidebarCollapsed", "onboardingCompleted"],
};

const workspacePersistConfig = {
  key: "workspace",
  storage,
  whitelist: [
    "selectedModelByProvider",
    "selectedProviderId",
    "thinkingEnabled",
  ],
};

const persistedChatReducer = persistReducer(chatPersistConfig, chatReducer);
const persistedSpaceReducer = persistReducer(spacePersistConfig, spaceReducer);
const persistedAppSettingsReducer = persistReducer(
  appSettingsPersistConfig,
  appSettingsReducer,
);
const persistedWorkspaceReducer = persistReducer(
  workspacePersistConfig,
  workspaceReducer,
);

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    chat: persistedChatReducer,
    space: persistedSpaceReducer,
    appSettings: persistedAppSettingsReducer,
    workspace: persistedWorkspaceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
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

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
