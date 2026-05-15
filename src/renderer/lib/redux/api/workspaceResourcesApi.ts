import type { ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";
import type { IssueWithEntity } from "./entitiesApi";

export interface ProjectResource {
  id: string;
  projectId: string;
  resourceId: string;
  createdAt: string;
}

export interface ProjectResourceWithDetails extends ProjectResource {
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

export type ProjectIssue = IssueWithEntity;

export const projectResourcesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjectResources: builder.query<
      ProjectResourceWithDetails[],
      string
    >({
      query: (projectId) => ({
        handler: "projectResources:getByProject",
        args: [projectId],
      }),
      transformResponse: (response: ServiceResponse<{ resources: ProjectResourceWithDetails[] }>) =>
        response.success ? response.data.resources : [],
      providesTags: (_result, _error, projectId) => [
        { type: "ProjectResources", id: projectId },
      ],
    }),

    getAvailableResources: builder.query<AvailableResource[], string>({
      query: (projectId) => ({
        handler: "projectResources:getAvailable",
        args: [projectId],
      }),
      transformResponse: (response: ServiceResponse<{ resources: AvailableResource[] }>) =>
        response.success ? response.data.resources : [],
      providesTags: ["ProjectResources"],
    }),

    addProjectResource: builder.mutation<
      { success: boolean },
      { projectId: string; resourceId: string }
    >({
      query: (payload) => ({
        handler: "projectResources:add",
        args: [payload],
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "ProjectResources", id: projectId },
        { type: "ProjectIssues", id: projectId },
      ],
    }),

    removeProjectResource: builder.mutation<
      { success: boolean },
      { projectId: string; resourceId: string }
    >({
      query: (payload) => ({
        handler: "projectResources:remove",
        args: [payload],
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "ProjectResources", id: projectId },
        { type: "ProjectIssues", id: projectId },
      ],
    }),

    getIssuesByProject: builder.query<ProjectIssue[], string>({
      query: (projectId) => ({
        handler: "projectResources:getIssues",
        args: [projectId],
      }),
      transformResponse: (response: ServiceResponse<{ issues: ProjectIssue[] }>) =>
        response.success ? response.data.issues : [],
      providesTags: (_result, _error, projectId) => [
        { type: "ProjectIssues", id: projectId },
      ],
    }),
  }),
});

export const {
  useGetProjectResourcesQuery,
  useGetAvailableResourcesQuery,
  useLazyGetAvailableResourcesQuery,
  useAddProjectResourceMutation,
  useRemoveProjectResourceMutation,
  useGetIssuesByProjectQuery,
} = projectResourcesApi;
