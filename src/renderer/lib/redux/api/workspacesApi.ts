import { unwrap, type ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";

export interface WorkspaceMetadata {
  language?: string;
  framework?: string;
  packageManager?: string;
  [key: string]: unknown;
}

export type WorkspaceStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "canceled"
  | "duplicate";

export interface Workspace {
  id: string;
  accountId: string;
  projectId: string | null;
  name: string;
  rootPath: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  metadata: WorkspaceMetadata | null;
  status: WorkspaceStatus;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkspacePayload {
  id: string;
  accountId: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata?: WorkspaceMetadata;
  projectId?: string;
}

export interface UpdateWorkspacePayload {
  name?: string;
  rootPath?: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata?: WorkspaceMetadata;
  status?: WorkspaceStatus;
}

export const workspacesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspaces: builder.query<Workspace[], void>({
      query: () => ({
        handler: CHANNELS.workspaces.getAll,
      }),
      transformResponse: (response: ServiceResponse<Workspace[]>) => unwrap(response),
      providesTags: ["Workspaces"],
    }),

    getWorkspaceById: builder.query<Workspace, string>({
      query: (id) => ({
        handler: CHANNELS.workspaces.getById,
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "Workspaces", id }],
    }),

    getWorkspacesByAccount: builder.query<Workspace[], string>({
      query: (accountId) => ({
        handler: CHANNELS.workspaces.getByAccount,
        args: [accountId],
      }),
      transformResponse: (response: ServiceResponse<Workspace[]>) => unwrap(response),
      providesTags: ["Workspaces"],
    }),

    getWorkspaceByRootPath: builder.query<
      Workspace,
      { accountId: string; rootPath: string }
    >({
      query: ({ accountId, rootPath }) => ({
        handler: CHANNELS.workspaces.getByRootPath,
        args: [accountId, rootPath],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) => unwrap(response),
      providesTags: ["Workspaces"],
    }),

    createWorkspace: builder.mutation<string, CreateWorkspacePayload>({
      query: (payload) => ({
        handler: CHANNELS.workspaces.create,
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<string>) => unwrap(response),
      invalidatesTags: ["Workspaces"],
    }),

    updateWorkspace: builder.mutation<
      Workspace,
      { id: string; payload: UpdateWorkspacePayload }
    >({
      query: ({ id, payload }) => ({
        handler: CHANNELS.workspaces.update,
        args: [id, payload],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) => unwrap(response),
      invalidatesTags: (_result, _error, { id }) => [
        "Workspaces",
        { type: "Workspaces", id },
      ],
    }),

    deleteWorkspace: builder.mutation<void, string>({
      query: (id) => ({
        handler: CHANNELS.workspaces.delete,
        args: [id],
      }),
      invalidatesTags: ["Workspaces"],
    }),

    archiveWorkspace: builder.mutation<Workspace, string>({
      query: (id) => ({
        handler: CHANNELS.workspaces.archive,
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) => unwrap(response),
      invalidatesTags: (_result, _error, id) => [
        "Workspaces",
        { type: "Workspaces", id },
      ],
    }),

    selectDirectory: builder.mutation<string | null, void>({
      query: () => ({
        handler: CHANNELS.workspaces.selectDirectory,
      }),
      transformResponse: (response: ServiceResponse<string | null>) => unwrap(response),
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
  useArchiveWorkspaceMutation,
  useSelectDirectoryMutation,
} = workspacesApi;
