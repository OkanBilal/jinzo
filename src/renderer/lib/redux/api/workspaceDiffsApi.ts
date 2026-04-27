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

export type WorkspaceDiffSummary = Omit<WorkspaceDiff, "diffText">;

export const workspaceDiffsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLatestWorkspaceDiff: builder.query<WorkspaceDiff | null, string>({
      queryFn: async (workspaceId) => {
        const result = await window.api.workspaceDiffs.getLatest(workspaceId);
        return { data: result.success ? (result.data ?? null) : null };
      },
      // Diff text can be huge; drop it quickly when no subscribers remain.
      keepUnusedDataFor: 15,
      providesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),

    getLatestWorkspaceDiffSummary: builder.query<
      WorkspaceDiffSummary | null,
      string
    >({
      queryFn: async (workspaceId) => {
        const result =
          await window.api.workspaceDiffs.getLatestSummary(workspaceId);
        return { data: result.success ? (result.data ?? null) : null };
      },
      keepUnusedDataFor: 60,
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
      keepUnusedDataFor: 15,
      providesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),
  }),
});

export const {
  useGetLatestWorkspaceDiffQuery,
  useLazyGetLatestWorkspaceDiffQuery,
  useGetLatestWorkspaceDiffSummaryQuery,
  useLazyGetLatestWorkspaceDiffSummaryQuery,
  useGetWorkspaceDiffsQuery,
  useLazyGetWorkspaceDiffsQuery,
} = workspaceDiffsApi;
