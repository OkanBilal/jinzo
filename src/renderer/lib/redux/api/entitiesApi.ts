import { baseApi } from "./baseApi";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";

export interface Entity {
  id: string;
  accountId: string;
  kind: string;
  title: string;
  url: string;
  body: string | null;
  summary: string | null;
  occurredAt: string;
  connectionId: string | null;
  resourceId: string | null;
  externalId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntityQueryParams {
  kinds?: string[];
  connectionIds?: string[];
  limit?: number;
  offset?: number;
  search?: string;
}

export interface CreateEntityPayload {
  kind: string;
  title: string;
  url: string;
  body?: string | null;
  summary?: string | null;
  occurredAt?: string;
  connectionId?: string | null;
  resourceId?: string | null;
  externalId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface UpdateEntityPayload {
  id: string;
  kind?: string;
  title?: string;
  url?: string;
  body?: string | null;
  summary?: string | null;
  metadata?: Record<string, any> | null;
}

export interface Task {
  id: string;
  entityId: string;
  status: string;
  priority: number;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  entityId: string;
  state: string;
  labels: string | null;
  assignees: string | null;
  milestone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueRecord {
  entityId: string;
  provider: string;
  state: string;
  number: number | null;
  repo: string | null;
  assignee: string | null;
  labels: string | null;
  closedAt: string | null;
  priority: number;
}

export interface IssueWithEntity {
  issue: IssueRecord;
  entity: Entity;
}

export const entitiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEntities: builder.query<Entity[], EntityQueryParams>({
      query: (params) => ({
        handler: CHANNELS.entities.getAll,
        args: [params],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Entity" as const, id })),
              { type: "Entity", id: "LIST" },
            ]
          : [{ type: "Entity", id: "LIST" }],
    }),

    getEntityById: builder.query<Entity | null, string>({
      query: (id) => ({
        handler: CHANNELS.entities.getById,
        args: [id],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      providesTags: (_result, _error, id) => [{ type: "Entity", id }],
    }),

    createEntity: builder.mutation<Entity, CreateEntityPayload>({
      query: (payload) => ({
        handler: CHANNELS.entities.create,
        args: [payload],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: [{ type: "Entity", id: "LIST" }],
    }),

    updateEntity: builder.mutation<Entity, UpdateEntityPayload>({
      query: (payload) => ({
        handler: CHANNELS.entities.update,
        args: [payload.id, payload],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Entity", id },
        { type: "Entity", id: "LIST" },
      ],
    }),

    deleteEntity: builder.mutation<boolean, string>({
      query: (id) => ({
        handler: CHANNELS.entities.delete,
        args: [id],
      }),
      transformResponse: (response: any) => response.success,
      invalidatesTags: (_result, _error, id) => [
        { type: "Entity", id },
        { type: "Entity", id: "LIST" },
      ],
    }),

    searchEntities: builder.query<Entity[], { query: string; limit?: number }>({
      query: ({ query, limit }) => ({
        handler: CHANNELS.entities.search,
        args: [query, limit],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
    }),

    getTasks: builder.query<Task[], { status?: string; limit?: number }>({
      query: (params) => ({
        handler: CHANNELS.tasks.getAll,
        args: [params],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: ["Task"],
    }),

    getTaskByEntityId: builder.query<Task | null, string>({
      query: (entityId) => ({
        handler: CHANNELS.tasks.getById,
        args: [entityId],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      providesTags: (_result, _error, entityId) => [
        { type: "Task", id: entityId },
      ],
    }),

    updateTaskStatus: builder.mutation<
      Task,
      { entityId: string; status: string }
    >({
      query: ({ entityId, status }) => ({
        handler: CHANNELS.tasks.update,
        args: [entityId, { status }],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: ["Task"],
    }),

    getIssues: builder.query<Issue[], { state?: string; limit?: number }>({
      query: (params) => ({
        handler: CHANNELS.issues.getAll,
        args: [params],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: ["Issue"],
    }),

    getIssueByEntityId: builder.query<Issue | null, string>({
      query: (entityId) => ({
        handler: CHANNELS.issues.getById,
        args: [entityId],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      providesTags: (_result, _error, entityId) => [
        { type: "Issue", id: entityId },
      ],
    }),

    updateIssueState: builder.mutation<
      Issue,
      { entityId: string; state: string }
    >({
      query: ({ entityId, state }) => ({
        handler: CHANNELS.issues.update,
        args: [entityId, { state }],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: ["Issue"],
    }),

    getIssuesByRepo: builder.query<IssueWithEntity[], { repo: string }>({
      query: ({ repo }) => ({
        handler: CHANNELS.issues.getAll,
        args: [{ repo }],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: ["Issue"],
    }),

  }),
  overrideExisting: false,
});

export const {
  useGetEntitiesQuery,
  useLazyGetEntitiesQuery,
  useGetEntityByIdQuery,
  useLazyGetEntityByIdQuery,
  useCreateEntityMutation,
  useUpdateEntityMutation,
  useDeleteEntityMutation,
  useSearchEntitiesQuery,
  useLazySearchEntitiesQuery,
  useGetTasksQuery,
  useGetTaskByEntityIdQuery,
  useUpdateTaskStatusMutation,
  useGetIssuesQuery,
  useGetIssueByEntityIdQuery,
  useUpdateIssueStateMutation,
  useGetIssuesByRepoQuery,
} = entitiesApi;
