import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import { baseApi } from './api/baseApi';
import chatReducer from './slices/chatSlice';

const persistConfig = {
  key: 'chat',
  storage,
  whitelist: ['selectedModel', 'thinkingLevel', 'thinkingEnabled', 'toolMode'],
};

const persistedChatReducer = persistReducer(persistConfig, chatReducer);

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    chat: persistedChatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'api/executeQuery/pending',
          'api/executeQuery/fulfilled',
          'api/executeMutation/pending',
          'api/executeMutation/fulfilled',
          'persist/PERSIST',
          'persist/REHYDRATE',
        ],
        ignoredPaths: ['api.queries', 'api.mutations'],
      },
    }).concat(baseApi.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
