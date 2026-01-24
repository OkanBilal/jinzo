import { baseApi } from "./baseApi";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface WorkspaceMetadata {
  language?: string;
  framework?: string;
  packageManager?: string;
  [key: string]: unknown;
}

export interface Workspace {
  id: string;
  accountId: string;
  name: string;
  rootPath: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  metadata: WorkspaceMetadata | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWorkspacePayload {
  id: string;
  accountId: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata?: WorkspaceMetadata;
}

export interface UpdateWorkspacePayload {
  name?: string;
  rootPath?: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata?: WorkspaceMetadata;
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export const workspacesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspaces: builder.query<Workspace[], void>({
      query: () => ({
        handler: "workspaces:getAll",
      }),
      transformResponse: (response: { success: boolean; data: Workspace[] }) =>
        response.data,
      providesTags: ["Workspaces"],
    }),

    getWorkspaceById: builder.query<Workspace, string>({
      query: (id) => ({
        handler: "workspaces:getById",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Workspace }) =>
        response.data,
      providesTags: (_result, _error, id) => [{ type: "Workspaces", id }],
    }),

    getWorkspacesByAccount: builder.query<Workspace[], string>({
      query: (accountId) => ({
        handler: "workspaces:getByAccount",
        args: [accountId],
      }),
      transformResponse: (response: { success: boolean; data: Workspace[] }) =>
        response.data,
      providesTags: ["Workspaces"],
    }),

    getWorkspaceByRootPath: builder.query<
      Workspace,
      { accountId: string; rootPath: string }
    >({
      query: ({ accountId, rootPath }) => ({
        handler: "workspaces:getByRootPath",
        args: [accountId, rootPath],
      }),
      transformResponse: (response: { success: boolean; data: Workspace }) =>
        response.data,
      providesTags: ["Workspaces"],
    }),

    createWorkspace: builder.mutation<string, CreateWorkspacePayload>({
      query: (payload) => ({
        handler: "workspaces:create",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: string }) =>
        response.data,
      invalidatesTags: ["Workspaces"],
    }),

    updateWorkspace: builder.mutation<
      Workspace,
      { id: string; payload: UpdateWorkspacePayload }
    >({
      query: ({ id, payload }) => ({
        handler: "workspaces:update",
        args: [id, payload],
      }),
      transformResponse: (response: { success: boolean; data: Workspace }) =>
        response.data,
      invalidatesTags: (_result, _error, { id }) => [
        "Workspaces",
        { type: "Workspaces", id },
      ],
    }),

    deleteWorkspace: builder.mutation<void, string>({
      query: (id) => ({
        handler: "workspaces:delete",
        args: [id],
      }),
      invalidatesTags: ["Workspaces"],
    }),
  }),
});

export const {
  useGetWorkspacesQuery,
  useLazyGetWorkspacesQuery,
  useGetWorkspaceByIdQuery,
  useLazyGetWorkspaceByIdQuery,
  useGetWorkspacesByAccountQuery,
  useLazyGetWorkspacesByAccountQuery,
  useGetWorkspaceByRootPathQuery,
  useLazyGetWorkspaceByRootPathQuery,
  useCreateWorkspaceMutation,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
} = workspacesApi;
