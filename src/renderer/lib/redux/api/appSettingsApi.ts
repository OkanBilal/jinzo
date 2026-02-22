import { baseApi } from "./baseApi";

export interface AppSettings {
  id: string;
  accountId: string;
  activeMoodId: string | null;
  enableWorktrees: boolean;
  showToolCalls: boolean;
  preventSleepDuringRuns: boolean;
  notifyOnRunComplete: boolean;
  notifyOnToolApproval: boolean;
  createdAt: number;
  updatedAt: number;
}

export const appSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAppSettings: builder.query<AppSettings, void>({
      query: () => ({
        handler: "appSettings:get",
      }),
      transformResponse: (response: { success: boolean; data: AppSettings }) =>
        response.data,
      providesTags: ["AppSettings"],
    }),

    setActiveMood: builder.mutation<AppSettings, string | null>({
      query: (moodId) => ({
        handler: "appSettings:setActiveMood",
        args: [moodId],
      }),
      transformResponse: (response: { success: boolean; data: AppSettings }) =>
        response.data,
      invalidatesTags: ["AppSettings"],
    }),

    setEnableWorktrees: builder.mutation<AppSettings, boolean>({
      query: (enabled) => ({
        handler: "appSettings:setEnableWorktrees",
        args: [enabled],
      }),
      transformResponse: (response: { success: boolean; data: AppSettings }) =>
        response.data,
      invalidatesTags: ["AppSettings"],
    }),

    setShowToolCalls: builder.mutation<AppSettings, boolean>({
      query: (enabled) => ({
        handler: "appSettings:setShowToolCalls",
        args: [enabled],
      }),
      transformResponse: (response: { success: boolean; data: AppSettings }) =>
        response.data,
      invalidatesTags: ["AppSettings"],
    }),

    setPreventSleepDuringRuns: builder.mutation<AppSettings, boolean>({
      query: (enabled) => ({
        handler: "appSettings:setPreventSleepDuringRuns",
        args: [enabled],
      }),
      transformResponse: (response: { success: boolean; data: AppSettings }) =>
        response.data,
      invalidatesTags: ["AppSettings"],
    }),

    setNotifyOnRunComplete: builder.mutation<AppSettings, boolean>({
      query: (enabled) => ({
        handler: "appSettings:setNotifyOnRunComplete",
        args: [enabled],
      }),
      transformResponse: (response: { success: boolean; data: AppSettings }) =>
        response.data,
      invalidatesTags: ["AppSettings"],
    }),

    setNotifyOnToolApproval: builder.mutation<AppSettings, boolean>({
      query: (enabled) => ({
        handler: "appSettings:setNotifyOnToolApproval",
        args: [enabled],
      }),
      transformResponse: (response: { success: boolean; data: AppSettings }) =>
        response.data,
      invalidatesTags: ["AppSettings"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAppSettingsQuery,
  useLazyGetAppSettingsQuery,
  useSetActiveMoodMutation,
  useSetEnableWorktreesMutation,
  useSetShowToolCallsMutation,
  useSetPreventSleepDuringRunsMutation,
  useSetNotifyOnRunCompleteMutation,
  useSetNotifyOnToolApprovalMutation,
} = appSettingsApi;
