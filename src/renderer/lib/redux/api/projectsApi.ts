import { unwrap, type ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";

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

export const projectsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query<Project[], void>({
      query: () => ({
        handler: CHANNELS.projects.getAll,
      }),
      transformResponse: (response: ServiceResponse<Project[]>) => unwrap(response),
      providesTags: ["Projects"],
    }),

    getProjectById: builder.query<Project, string>({
      query: (id) => ({
        handler: CHANNELS.projects.getById,
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<Project>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "Projects", id }],
    }),

    getProjectsByAccount: builder.query<Project[], string>({
      query: (accountId) => ({
        handler: CHANNELS.projects.getByAccount,
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
  }),
});

export const {
  useGetProjectsQuery,
  useLazyGetProjectsQuery,
  useGetProjectByIdQuery,
  useLazyGetProjectByIdQuery,
  useGetProjectsByAccountQuery,
  useLazyGetProjectsByAccountQuery,
  useFindProjectByRemoteOriginQuery,
  useLazyFindProjectByRemoteOriginQuery,
  useFindOrCreateProjectMutation,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useRemoveProjectMutation,
  useDeleteProjectMutation,
  useArchiveProjectMutation,
} = projectsApi;
