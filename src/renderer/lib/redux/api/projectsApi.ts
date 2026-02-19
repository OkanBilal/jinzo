import { baseApi } from "./baseApi";

export interface Project {
  id: string;
  accountId: string;
  name: string;
  rootPath: string;
  workspacesPath: string | null;
  branches: string[] | null;
  remoteOrigin: string;
  defaultBranch: string | null;
  setupScript: string | null;
  runScript: string | null;
  archiveScript: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectPayload {
  id?: string;
  accountId: string;
  name: string;
  rootPath: string;
  remoteOrigin: string;
  workspacesPath?: string;
  branches?: string[];
  defaultBranch?: string;
  setupScript?: string;
  runScript?: string;
  archiveScript?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  rootPath?: string;
  workspacesPath?: string;
  branches?: string[];
  remoteOrigin?: string;
  defaultBranch?: string;
  setupScript?: string;
  runScript?: string;
  archiveScript?: string;
}

export const projectsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query<Project[], void>({
      query: () => ({
        handler: "projects:getAll",
      }),
      transformResponse: (response: { success: boolean; data: Project[] }) =>
        response.data,
      providesTags: ["Projects"],
    }),

    getProjectById: builder.query<Project, string>({
      query: (id) => ({
        handler: "projects:getById",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Project }) =>
        response.data,
      providesTags: (_result, _error, id) => [{ type: "Projects", id }],
    }),

    getProjectsByAccount: builder.query<Project[], string>({
      query: (accountId) => ({
        handler: "projects:getByAccount",
        args: [accountId],
      }),
      transformResponse: (response: { success: boolean; data: Project[] }) =>
        response.data,
      providesTags: ["Projects"],
    }),

    findProjectByRemoteOrigin: builder.query<
      Project,
      { accountId: string; remoteOrigin: string }
    >({
      query: ({ accountId, remoteOrigin }) => ({
        handler: "projects:findByRemoteOrigin",
        args: [accountId, remoteOrigin],
      }),
      transformResponse: (response: { success: boolean; data: Project }) =>
        response.data,
      providesTags: ["Projects"],
    }),

    findOrCreateProject: builder.mutation<Project, CreateProjectPayload>({
      query: (payload) => ({
        handler: "projects:findOrCreate",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: Project }) =>
        response.data,
      invalidatesTags: ["Projects"],
    }),

    createProject: builder.mutation<Project, CreateProjectPayload>({
      query: (payload) => ({
        handler: "projects:create",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: Project }) =>
        response.data,
      invalidatesTags: ["Projects"],
    }),

    updateProject: builder.mutation<
      Project,
      { id: string; payload: UpdateProjectPayload }
    >({
      query: ({ id, payload }) => ({
        handler: "projects:update",
        args: [id, payload],
      }),
      transformResponse: (response: { success: boolean; data: Project }) =>
        response.data,
      invalidatesTags: (_result, _error, { id }) => [
        "Projects",
        { type: "Projects", id },
      ],
    }),

    deleteProject: builder.mutation<void, string>({
      query: (id) => ({
        handler: "projects:delete",
        args: [id],
      }),
      invalidatesTags: ["Projects"],
    }),

    archiveProject: builder.mutation<Project, string>({
      query: (id) => ({
        handler: "projects:archive",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Project }) =>
        response.data,
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
  useDeleteProjectMutation,
  useArchiveProjectMutation,
} = projectsApi;
