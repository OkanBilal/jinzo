import { baseApi } from "./baseApi";

export interface SyncStats {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface SyncResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
  duration: number;
  stats: {
    itemsPerSecond: number;
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
      invalidatesTags: ["Entity", "Feed", "ProjectIssues"],
    }),
  }),
  overrideExisting: false,
});

export const { useRunEntitySyncMutation } = syncApi;
