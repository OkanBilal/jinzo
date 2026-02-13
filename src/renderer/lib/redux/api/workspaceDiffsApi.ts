import { baseApi } from "./baseApi";

export interface WorkspaceDiff {
  id: string;
  workspaceId: string;
  runId: string | null;
  baseRef: string | null;
  diffText: string;
  files: string[] | null;
  stats: { shortstat: string; files: number } | null;
  createdAt: number;
}

export const workspaceDiffsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLatestWorkspaceDiff: builder.query<WorkspaceDiff | null, string>({
      query: (workspaceId) => ({
        handler: "workspaceDiffs:getLatest",
        args: [workspaceId],
      }),
      transformResponse: (response: {
        success: boolean;
        data?: WorkspaceDiff;
        error?: string;
      }) => (response.success ? (response.data ?? null) : null),
      providesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),

    getWorkspaceDiffs: builder.query<
      WorkspaceDiff[],
      { workspaceId: string; limit?: number }
    >({
      query: ({ workspaceId, limit }) => ({
        handler: "workspaceDiffs:getByWorkspace",
        args: [workspaceId, limit],
      }),
      transformResponse: (response: {
        success: boolean;
        data: WorkspaceDiff[];
      }) => response.data,
      providesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),
  }),
});

export const {
  useGetLatestWorkspaceDiffQuery,
  useLazyGetLatestWorkspaceDiffQuery,
  useGetWorkspaceDiffsQuery,
  useLazyGetWorkspaceDiffsQuery,
} = workspaceDiffsApi;
