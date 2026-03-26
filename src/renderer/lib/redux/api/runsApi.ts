import { baseApi } from "./baseApi";

export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";
export type RunContextKind =
  | "file"
  | "selection"
  | "diff"
  | "git"
  | "terminal"
  | "env"
  | "note";
export type RunArtifactKind =
  | "patch"
  | "file"
  | "log"
  | "report"
  | "command_result";

export interface Run {
  id: string;
  accountId: string;
  workspaceId: string | null;
  spaceId: string | null;
  providerId: string;
  model: string | null;
  title: string | null;
  goal: string | null;
  status: RunStatus;
  systemPrompt: string | null;
  configSnapshot: Record<string, unknown> | null;
  toolPolicySnapshot: Record<string, unknown> | null;
  startedAt: number | null;
  endedAt: number | null;
  lastError: string | null;
  sessionId: string | null;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRunPayload {
  id: string;
  accountId: string;
  workspaceId?: string;
  spaceId?: string;
  providerId: string;
  model?: string;
  title?: string;
  goal?: string;
  status?: RunStatus;
  systemPrompt?: string;
  configSnapshot?: Record<string, unknown>;
  toolPolicySnapshot?: Record<string, unknown>;
}

export interface UpdateRunPayload {
  title?: string;
  goal?: string;
  status?: RunStatus;
  model?: string;
  systemPrompt?: string;
  configSnapshot?: Record<string, unknown>;
  toolPolicySnapshot?: Record<string, unknown>;
  startedAt?: number;
  endedAt?: number;
  lastError?: string;
}

export interface RunContext {
  id: number;
  runId: string;
  kind: RunContextKind;
  ref: string | null;
  content: string | null;
  entityId: string | null;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface CreateRunContextPayload {
  runId: string;
  kind: RunContextKind;
  ref?: string;
  content?: string;
  entityId?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface RunArtifact {
  id: number;
  runId: string;
  kind: RunArtifactKind;
  path: string | null;
  content: string | null;
  entityId: string | null;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface CreateRunArtifactPayload {
  runId: string;
  kind: RunArtifactKind;
  path?: string;
  content?: string;
  entityId?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}


export type RunTurnStatus = "active" | "completed";

export interface ModelUsageEntry {
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface RunTurn {
  id: number;
  runId: string;
  turnIndex: number;
  promptContent: string | null;
  responseContent: string | null;
  startedAt: number | null;
  endedAt: number | null;
  elapsedMs: number | null;
  status: RunTurnStatus;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  costMicros: number | null;
  model: string | null;
  modelUsage: Record<string, ModelUsageEntry> | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export const runsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRuns: builder.query<Run[], number | void>({
      query: (limit) => ({
        handler: "runs:getAll",
        args: limit ? [limit] : [],
      }),
      transformResponse: (response: { success: boolean; data: Run[] }) =>
        response.data,
      providesTags: ["Runs"],
    }),

    getRunById: builder.query<Run, string>({
      query: (id) => ({
        handler: "runs:getById",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Run }) =>
        response.data,
      providesTags: (_result, _error, id) => [{ type: "Runs", id }],
    }),

    getRunsByAccount: builder.query<
      Run[],
      { accountId: string; limit?: number }
    >({
      query: ({ accountId, limit }) => ({
        handler: "runs:getByAccount",
        args: [accountId, limit],
      }),
      transformResponse: (response: { success: boolean; data: Run[] }) =>
        response.data,
      providesTags: ["Runs"],
    }),

    getRunsByWorkspace: builder.query<
      Run[],
      { workspaceId: string; limit?: number }
    >({
      query: ({ workspaceId, limit }) => ({
        handler: "runs:getByWorkspace",
        args: [workspaceId, limit],
      }),
      transformResponse: (response: { success: boolean; data: Run[] }) =>
        response.data,
      providesTags: ["Runs"],
    }),

    getRunsByStatus: builder.query<
      Run[],
      { accountId: string; status: RunStatus }
    >({
      query: ({ accountId, status }) => ({
        handler: "runs:getByStatus",
        args: [accountId, status],
      }),
      transformResponse: (response: { success: boolean; data: Run[] }) =>
        response.data,
      providesTags: ["Runs"],
    }),

    createRun: builder.mutation<string, CreateRunPayload>({
      query: (payload) => ({
        handler: "runs:create",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: string }) =>
        response.data,
      invalidatesTags: ["Runs"],
    }),

    updateRun: builder.mutation<Run, { id: string; payload: UpdateRunPayload }>(
      {
        query: ({ id, payload }) => ({
          handler: "runs:update",
          args: [id, payload],
        }),
        transformResponse: (response: { success: boolean; data: Run }) =>
          response.data,
        invalidatesTags: (_result, _error, { id }) => [
          "Runs",
          { type: "Runs", id },
        ],
      },
    ),

    startRun: builder.mutation<Run, string>({
      query: (id) => ({
        handler: "runs:start",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Run }) =>
        response.data,
      invalidatesTags: (_result, _error, id) => ["Runs", { type: "Runs", id }],
    }),

    completeRun: builder.mutation<Run, string>({
      query: (id) => ({
        handler: "runs:complete",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Run }) =>
        response.data,
      invalidatesTags: (_result, _error, id) => ["Runs", { type: "Runs", id }],
    }),

    failRun: builder.mutation<Run, { id: string; error: string }>({
      query: ({ id, error }) => ({
        handler: "runs:fail",
        args: [id, error],
      }),
      transformResponse: (response: { success: boolean; data: Run }) =>
        response.data,
      invalidatesTags: (_result, _error, { id }) => [
        "Runs",
        { type: "Runs", id },
      ],
    }),

    cancelRun: builder.mutation<Run, string>({
      query: (id) => ({
        handler: "runs:cancel",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Run }) =>
        response.data,
      invalidatesTags: (_result, _error, id) => ["Runs", { type: "Runs", id }],
    }),

    abortRun: builder.mutation<void, string>({
      query: (runId) => ({
        handler: "runs:abort",
        args: [runId],
      }),
      invalidatesTags: (_result, _error, runId) => ["Runs", { type: "Runs", id: runId }],
    }),

    deleteRun: builder.mutation<void, string>({
      query: (id) => ({
        handler: "runs:delete",
        args: [id],
      }),
      invalidatesTags: ["Runs"],
    }),

    archiveRun: builder.mutation<Run, string>({
      query: (id) => ({
        handler: "runs:archive",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Run }) =>
        response.data,
      invalidatesTags: (_result, _error, id) => ["Runs", { type: "Runs", id }],
    }),

    getRunContext: builder.query<RunContext[], string>({
      query: (runId) => ({
        handler: "runContext:getByRun",
        args: [runId],
      }),
      transformResponse: (response: { success: boolean; data: RunContext[] }) =>
        response.data,
      providesTags: (_result, _error, runId) => [
        { type: "RunContext", id: runId },
      ],
    }),

    addRunContext: builder.mutation<number, CreateRunContextPayload>({
      query: (payload) => ({
        handler: "runContext:add",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: number }) =>
        response.data,
      invalidatesTags: (_result, _error, { runId }) => [
        "RunContext",
        { type: "RunContext", id: runId },
      ],
    }),

    removeRunContext: builder.mutation<void, { id: number; runId: string }>({
      query: ({ id }) => ({
        handler: "runContext:remove",
        args: [id],
      }),
      invalidatesTags: (_result, _error, { runId }) => [
        "RunContext",
        { type: "RunContext", id: runId },
      ],
    }),

    getRunArtifacts: builder.query<RunArtifact[], string>({
      query: (runId) => ({
        handler: "runArtifacts:getByRun",
        args: [runId],
      }),
      transformResponse: (response: {
        success: boolean;
        data: RunArtifact[];
      }) => response.data,
      providesTags: (_result, _error, runId) => [
        { type: "RunArtifacts", id: runId },
      ],
    }),

    addRunArtifact: builder.mutation<number, CreateRunArtifactPayload>({
      query: (payload) => ({
        handler: "runArtifacts:add",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: number }) =>
        response.data,
      invalidatesTags: (_result, _error, { runId }) => [
        "RunArtifacts",
        { type: "RunArtifacts", id: runId },
      ],
    }),

    removeRunArtifact: builder.mutation<void, { id: number; runId: string }>({
      query: ({ id }) => ({
        handler: "runArtifacts:remove",
        args: [id],
      }),
      invalidatesTags: (_result, _error, { runId }) => [
        "RunArtifacts",
        { type: "RunArtifacts", id: runId },
      ],
    }),


    getRunTurns: builder.query<RunTurn[], string>({
      query: (runId) => ({
        handler: "runTurns:getByRun",
        args: [runId],
      }),
      transformResponse: (response: { success: boolean; data: RunTurn[] }) =>
        response.data,
      providesTags: (_result, _error, runId) => [
        { type: "RunTurns", id: runId },
      ],
    }),

  }),
});

export const {
  useGetRunsQuery,
  useLazyGetRunsQuery,
  useGetRunByIdQuery,
  useLazyGetRunByIdQuery,
  useGetRunsByAccountQuery,
  useLazyGetRunsByAccountQuery,
  useGetRunsByWorkspaceQuery,
  useLazyGetRunsByWorkspaceQuery,
  useGetRunsByStatusQuery,
  useLazyGetRunsByStatusQuery,
  useCreateRunMutation,
  useUpdateRunMutation,
  useStartRunMutation,
  useCompleteRunMutation,
  useFailRunMutation,
  useCancelRunMutation,
  useAbortRunMutation,
  useDeleteRunMutation,
  useArchiveRunMutation,
  useGetRunContextQuery,
  useLazyGetRunContextQuery,
  useAddRunContextMutation,
  useRemoveRunContextMutation,
  useGetRunArtifactsQuery,
  useLazyGetRunArtifactsQuery,
  useAddRunArtifactMutation,
  useRemoveRunArtifactMutation,
  useGetRunTurnsQuery,
  useLazyGetRunTurnsQuery,
} = runsApi;
