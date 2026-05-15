import { unwrap, type ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";
import type { IssueWithEntity } from "./entitiesApi";

export interface Project {
  id: string;
  accountId: string;
  name: string;
  rootPath: string;
  workspacesPath: string | null;
  branches: string[] | null;
  remoteOrigin: string | null;
  defaultBranch: string | null;
  setupScript: string | null;
  runScript: string | null;
  archiveScript: string | null;
  icon: string | null;
  commitInstructions: string | null;
  prInstructions: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectPayload {
  id?: string;
  accountId: string;
  name: string;
  rootPath: string;
  remoteOrigin?: string | null;
  workspacesPath?: string;
  branches?: string[];
  defaultBranch?: string;
  setupScript?: string;
  runScript?: string;
  archiveScript?: string;
  icon?: string;
  commitInstructions?: string;
  prInstructions?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  rootPath?: string;
  workspacesPath?: string;
  branches?: string[];
  remoteOrigin?: string | null;
  defaultBranch?: string;
  setupScript?: string;
  runScript?: string;
  archiveScript?: string;
  icon?: string | null;
  commitInstructions?: string;
  prInstructions?: string;
}

// ─────────────────────────────────────────────────────────────
// Project resources (formerly workspaceResourcesApi)
// ─────────────────────────────────────────────────────────────

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

export const projectsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── lifecycle ──
    listProjects: builder.query<Project[], void>({
      query: () => ({
        handler: CHANNELS.projects.list,
      }),
      transformResponse: (response: ServiceResponse<Project[]>) => unwrap(response),
      providesTags: ["Projects"],
    }),

    getProject: builder.query<Project, string>({
      query: (id) => ({
        handler: CHANNELS.projects.get,
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<Project>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "Projects", id }],
    }),

    listProjectsByAccount: builder.query<Project[], string>({
      query: (accountId) => ({
        handler: CHANNELS.projects.listByAccount,
        args: [accountId],
      }),
      transformResponse: (response: ServiceResponse<Project[]>) => unwrap(response),
      providesTags: ["Projects"],
    }),

    findProjectByRemoteOrigin: builder.query<
      Project,
      { accountId: string; remoteOrigin: string }
    >({
      query: ({ accountId, remoteOrigin }) => ({
        handler: CHANNELS.projects.findByRemoteOrigin,
        args: [accountId, remoteOrigin],
      }),
      transformResponse: (response: ServiceResponse<Project>) => unwrap(response),
      providesTags: ["Projects"],
    }),

    findOrCreateProject: builder.mutation<Project, CreateProjectPayload>({
      query: (payload) => ({
        handler: CHANNELS.projects.findOrCreate,
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<Project>) => unwrap(response),
      invalidatesTags: ["Projects"],
    }),

    createProject: builder.mutation<Project, CreateProjectPayload>({
      query: (payload) => ({
        handler: CHANNELS.projects.create,
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<Project>) => unwrap(response),
      invalidatesTags: ["Projects"],
    }),

    updateProject: builder.mutation<
      Project,
      { id: string; payload: UpdateProjectPayload }
    >({
      query: ({ id, payload }) => ({
        handler: CHANNELS.projects.update,
        args: [id, payload],
      }),
      transformResponse: (response: ServiceResponse<Project>) => unwrap(response),
      invalidatesTags: (_result, _error, { id }) => [
        "Projects",
        { type: "Projects", id },
      ],
    }),

    removeProject: builder.mutation<void, string>({
      query: (id) => ({
        handler: CHANNELS.projects.remove,
        args: [id],
      }),
      invalidatesTags: ["Projects", "Workspaces"],
    }),

    deleteProject: builder.mutation<void, string>({
      query: (id) => ({
        handler: CHANNELS.projects.delete,
        args: [id],
      }),
      invalidatesTags: ["Projects"],
    }),

    archiveProject: builder.mutation<Project, string>({
      query: (id) => ({
        handler: CHANNELS.projects.archive,
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<Project>) => unwrap(response),
      invalidatesTags: (_result, _error, id) => [
        "Projects",
        { type: "Projects", id },
      ],
    }),

    // ── resources ──
    listProjectResources: builder.query<ProjectResourceWithDetails[], string>({
      query: (projectId) => ({
        handler: CHANNELS.projects.listResources,
        args: [projectId],
      }),
      transformResponse: (response: ServiceResponse<{ resources: ProjectResourceWithDetails[] }>) =>
        response.success ? response.data.resources : [],
      providesTags: (_result, _error, projectId) => [
        { type: "ProjectResources", id: projectId },
      ],
    }),

    listAvailableResources: builder.query<AvailableResource[], string>({
      query: (projectId) => ({
        handler: CHANNELS.projects.listAvailableResources,
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
        handler: CHANNELS.projects.addResource,
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
        handler: CHANNELS.projects.removeResource,
        args: [payload],
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "ProjectResources", id: projectId },
        { type: "ProjectIssues", id: projectId },
      ],
    }),

    // ── issues (via linked resources) ──
    listProjectIssues: builder.query<ProjectIssue[], string>({
      query: (projectId) => ({
        handler: CHANNELS.projects.listIssues,
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
  // lifecycle
  useListProjectsQuery,
  useLazyListProjectsQuery,
  useGetProjectQuery,
  useLazyGetProjectQuery,
  useListProjectsByAccountQuery,
  useLazyListProjectsByAccountQuery,
  useFindProjectByRemoteOriginQuery,
  useLazyFindProjectByRemoteOriginQuery,
  useFindOrCreateProjectMutation,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useRemoveProjectMutation,
  useDeleteProjectMutation,
  useArchiveProjectMutation,
  // resources
  useListProjectResourcesQuery,
  useListAvailableResourcesQuery,
  useLazyListAvailableResourcesQuery,
  useAddProjectResourceMutation,
  useRemoveProjectResourceMutation,
  // issues
  useListProjectIssuesQuery,
} = projectsApi;
