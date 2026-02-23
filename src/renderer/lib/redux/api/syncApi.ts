import { baseApi } from "./baseApi";

export interface SyncStats {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  totalChunks: number;
}

export interface SyncResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
  totalChunks: number;
  duration: number;
  stats: {
    avgEmbeddingTime: number;
    itemsPerSecond: number;
    avgChunksPerItem: number;
  };
}

export const syncApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    runEntitySync: builder.mutation<SyncResult, string | void>({
      query: (provider) => ({
        handler: "sync:runEntitySync",
        args: provider ? [provider] : [],
      }),
      transformResponse: (response: { success: boolean; data: SyncResult }) =>
        response.data,
      invalidatesTags: ["Entity", "Feed", "WorkspaceIssues"],
    }),
  }),
  overrideExisting: false,
});

export const { useRunEntitySyncMutation } = syncApi;
