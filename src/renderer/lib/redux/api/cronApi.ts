import { baseApi } from "./baseApi";

export interface CronSyncStats {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface CronSyncResult {
  success: boolean;
  itemsFetched: number;
  stats: CronSyncStats;
  duration: number;
  timestamp: string;
}

export const cronApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    runFeedSync: builder.mutation<CronSyncResult, void>({
      query: () => ({
        handler: "cron:runFeedSync",
      }),
      transformResponse: (response: {
        success: boolean;
        data: CronSyncResult;
      }) => response.data,
      invalidatesTags: ["Feed"],
    }),
  }),
  overrideExisting: false,
});

export const { useRunFeedSyncMutation } = cronApi;
