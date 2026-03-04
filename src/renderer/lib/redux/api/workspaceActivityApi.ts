import { baseApi } from "./baseApi";

export type ActivityType = "diff" | "review" | "finding" | "commit" | "pr";

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  type: ActivityType;
  title: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  refId: string | null;
  createdAt: number;
}

export interface CreateWorkspaceActivityPayload {
  workspaceId: string;
  type: ActivityType;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  refId?: string;
}

export const workspaceActivityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspaceActivity: builder.query<
      WorkspaceActivity[],
      { workspaceId: string; limit?: number }
    >({
      query: ({ workspaceId, limit }) => ({
        handler: "workspaceActivity:getByWorkspace",
        args: [workspaceId, limit],
      }),
      transformResponse: (response: any) => response?.data ?? [],
      providesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceActivity", id: workspaceId },
      ],
    }),

    createWorkspaceActivity: builder.mutation<
      string,
      CreateWorkspaceActivityPayload
    >({
      query: (payload) => ({
        handler: "workspaceActivity:create",
        args: [payload],
      }),
      transformResponse: (response: any) => response?.data,
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceActivity", id: workspaceId },
      ],
    }),

    deleteWorkspaceActivity: builder.mutation<void, { id: string; workspaceId: string }>({
      query: ({ id }) => ({
        handler: "workspaceActivity:delete",
        args: [id],
      }),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceActivity", id: workspaceId },
      ],
    }),
  }),
});

export const {
  useGetWorkspaceActivityQuery,
  useCreateWorkspaceActivityMutation,
  useDeleteWorkspaceActivityMutation,
} = workspaceActivityApi;
