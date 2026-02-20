import { baseApi } from "./baseApi";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export type UpdateInfo = {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
};

export type UpdateProgress = {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
};

export type UpdateState = {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
};

export const updatesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUpdateStatus: builder.query<UpdateState, void>({
      query: () => ({ handler: "updates:getStatus" }),
      transformResponse: (response: any) =>
        response?.success ? response.data : { status: "idle", info: null, progress: null, error: null },
      providesTags: ["Updates"],
    }),
    checkForUpdates: builder.mutation<UpdateState, void>({
      query: () => ({ handler: "updates:check" }),
      transformResponse: (response: any) =>
        response?.success ? response.data : { status: "error", info: null, progress: null, error: response?.error },
      invalidatesTags: ["Updates"],
    }),
    downloadUpdate: builder.mutation<UpdateState, void>({
      query: () => ({ handler: "updates:download" }),
      transformResponse: (response: any) =>
        response?.success ? response.data : { status: "error", info: null, progress: null, error: response?.error },
      invalidatesTags: ["Updates"],
    }),
    installUpdate: builder.mutation<null, void>({
      query: () => ({ handler: "updates:quitAndInstall" }),
    }),
  }),
});

export const {
  useGetUpdateStatusQuery,
  useCheckForUpdatesMutation,
  useDownloadUpdateMutation,
  useInstallUpdateMutation,
} = updatesApi;
