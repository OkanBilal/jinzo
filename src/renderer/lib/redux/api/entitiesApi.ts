import { baseApi } from "./baseApi";

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

export interface PlaylistItem {
  id: string;
  entityId: string;
  playlistId: string;
  position: number;
  addedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const entitiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Entity CRUD
    getEntities: builder.query<Entity[], EntityQueryParams>({
      query: (params) => ({
        handler: "entities:getAll",
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
        handler: "entities:getById",
        args: [id],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      providesTags: (_result, _error, id) => [{ type: "Entity", id }],
    }),

    createEntity: builder.mutation<Entity, CreateEntityPayload>({
      query: (payload) => ({
        handler: "entities:create",
        args: [payload],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: [{ type: "Entity", id: "LIST" }],
    }),

    updateEntity: builder.mutation<Entity, UpdateEntityPayload>({
      query: (payload) => ({
        handler: "entities:update",
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
        handler: "entities:delete",
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
        handler: "entities:search",
        args: [query, limit],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
    }),

    // Tasks
    getTasks: builder.query<Task[], { status?: string; limit?: number }>({
      query: (params) => ({
        handler: "tasks:getAll",
        args: [params],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: ["Task"],
    }),

    getTaskByEntityId: builder.query<Task | null, string>({
      query: (entityId) => ({
        handler: "tasks:getByEntityId",
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
        handler: "tasks:updateStatus",
        args: [entityId, status],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: ["Task"],
    }),

    // Issues
    getIssues: builder.query<Issue[], { state?: string; limit?: number }>({
      query: (params) => ({
        handler: "issues:getAll",
        args: [params],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: ["Issue"],
    }),

    getIssueByEntityId: builder.query<Issue | null, string>({
      query: (entityId) => ({
        handler: "issues:getByEntityId",
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
        handler: "issues:updateState",
        args: [entityId, state],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: ["Issue"],
    }),

    // Playlists
    getPlaylistItems: builder.query<
      PlaylistItem[],
      { playlistId?: string; limit?: number }
    >({
      query: (params) => ({
        handler: "playlists:getItems",
        args: [params],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: ["Playlist"],
    }),
  }),
  overrideExisting: false,
});

export const {
  // Entities
  useGetEntitiesQuery,
  useLazyGetEntitiesQuery,
  useGetEntityByIdQuery,
  useLazyGetEntityByIdQuery,
  useCreateEntityMutation,
  useUpdateEntityMutation,
  useDeleteEntityMutation,
  useSearchEntitiesQuery,
  useLazySearchEntitiesQuery,
  // Tasks
  useGetTasksQuery,
  useGetTaskByEntityIdQuery,
  useUpdateTaskStatusMutation,
  // Issues
  useGetIssuesQuery,
  useGetIssueByEntityIdQuery,
  useUpdateIssueStateMutation,
  // Playlists
  useGetPlaylistItemsQuery,
} = entitiesApi;
