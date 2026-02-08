import { baseApi } from "./baseApi";
import type { IssueWithEntity } from "./entitiesApi";

export interface WorkspaceResource {
  id: string;
  workspaceId: string;
  resourceId: string;
  createdAt: string;
}

export interface WorkspaceResourceWithDetails extends WorkspaceResource {
  resource: {
    id: string;
    connectionId: string;
    externalId: string;
    kind: string;
    name: string | null;
    url: string | null;
    metadata: string | null;
  };
}

export interface AvailableResource {
  id: string;
  connectionId: string;
  externalId: string;
  kind: string;
  name: string | null;
  url: string | null;
  metadata: string | null;
  isLinked: boolean;
}

export type WorkspaceIssue = IssueWithEntity;

export const workspaceResourcesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspaceResources: builder.query<
      WorkspaceResourceWithDetails[],
      string
    >({
      query: (workspaceId) => ({
        handler: "workspaceResources:getByWorkspace",
        args: [workspaceId],
      }),
      transformResponse: (response: {
        success: boolean;
        data?: { resources: WorkspaceResourceWithDetails[] };
      }) => (response.success ? (response.data?.resources ?? []) : []),
      providesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceResources", id: workspaceId },
      ],
    }),

    getAvailableResources: builder.query<AvailableResource[], string>({
      query: (workspaceId) => ({
        handler: "workspaceResources:getAvailable",
        args: [workspaceId],
      }),
      transformResponse: (response: {
        success: boolean;
        data?: { resources: AvailableResource[] };
      }) => (response.success ? (response.data?.resources ?? []) : []),
      providesTags: ["WorkspaceResources"],
    }),

    addWorkspaceResource: builder.mutation<
      { success: boolean },
      { workspaceId: string; resourceId: string }
    >({
      query: (payload) => ({
        handler: "workspaceResources:add",
        args: [payload],
      }),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceResources", id: workspaceId },
        { type: "WorkspaceIssues", id: workspaceId },
      ],
    }),

    removeWorkspaceResource: builder.mutation<
      { success: boolean },
      { workspaceId: string; resourceId: string }
    >({
      query: (payload) => ({
        handler: "workspaceResources:remove",
        args: [payload],
      }),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceResources", id: workspaceId },
        { type: "WorkspaceIssues", id: workspaceId },
      ],
    }),

    getIssuesByWorkspace: builder.query<WorkspaceIssue[], string>({
      query: (workspaceId) => ({
        handler: "workspaceResources:getIssues",
        args: [workspaceId],
      }),
      transformResponse: (response: {
        success: boolean;
        data?: { issues: WorkspaceIssue[] };
      }) => (response.success ? (response.data?.issues ?? []) : []),
      providesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceIssues", id: workspaceId },
      ],
    }),
  }),
});

export const {
  useGetWorkspaceResourcesQuery,
  useGetAvailableResourcesQuery,
  useLazyGetAvailableResourcesQuery,
  useAddWorkspaceResourceMutation,
  useRemoveWorkspaceResourceMutation,
  useGetIssuesByWorkspaceQuery,
} = workspaceResourcesApi;
