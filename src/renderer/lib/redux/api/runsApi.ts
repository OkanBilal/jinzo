import { baseApi } from "./baseApi";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type RunContextKind = "file" | "selection" | "diff" | "git" | "terminal" | "env" | "note";
export type RunArtifactKind = "patch" | "file" | "log" | "report" | "command_result";
export type RunCommandStatus = "queued" | "running" | "done" | "error" | "canceled";

export interface Run {
  id: string;
  accountId: string;
  workspaceId: string | null;
  moodId: string | null;
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
  createdAt: number;
  updatedAt: number;
}

export interface CreateRunPayload {
  id: string;
  accountId: string;
  workspaceId?: string;
  moodId?: string;
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

export interface RunCommand {
  id: number;
  runId: string;
  cwd: string | null;
  command: string;
  envKeys: string[] | null;
  status: RunCommandStatus;
  startedAt: number | null;
  endedAt: number | null;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface CreateRunCommandPayload {
  runId: string;
  cwd?: string;
  command: string;
  envKeys?: string[];
  status?: RunCommandStatus;
}

export interface UpdateRunCommandPayload {
  status?: RunCommandStatus;
  startedAt?: number;
  endedAt?: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export const runsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Runs
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

    getRunsByAccount: builder.query<Run[], { accountId: string; limit?: number }>({
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

    getRunsByStatus: builder.query<Run[], { accountId: string; status: RunStatus }>({
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

    updateRun: builder.mutation<Run, { id: string; payload: UpdateRunPayload }>({
      query: ({ id, payload }) => ({
        handler: "runs:update",
        args: [id, payload],
      }),
      transformResponse: (response: { success: boolean; data: Run }) =>
        response.data,
      invalidatesTags: (_result, _error, { id }) => ["Runs", { type: "Runs", id }],
    }),

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
      invalidatesTags: (_result, _error, { id }) => ["Runs", { type: "Runs", id }],
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

    deleteRun: builder.mutation<void, string>({
      query: (id) => ({
        handler: "runs:delete",
        args: [id],
      }),
      invalidatesTags: ["Runs"],
    }),

    // Run Context
    getRunContext: builder.query<RunContext[], string>({
      query: (runId) => ({
        handler: "runContext:getByRun",
        args: [runId],
      }),
      transformResponse: (response: { success: boolean; data: RunContext[] }) =>
        response.data,
      providesTags: (_result, _error, runId) => [{ type: "RunContext", id: runId }],
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

    // Run Artifacts
    getRunArtifacts: builder.query<RunArtifact[], string>({
      query: (runId) => ({
        handler: "runArtifacts:getByRun",
        args: [runId],
      }),
      transformResponse: (response: { success: boolean; data: RunArtifact[] }) =>
        response.data,
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

    // Run Commands
    getRunCommands: builder.query<RunCommand[], string>({
      query: (runId) => ({
        handler: "runCommands:getByRun",
        args: [runId],
      }),
      transformResponse: (response: { success: boolean; data: RunCommand[] }) =>
        response.data,
      providesTags: (_result, _error, runId) => [
        { type: "RunCommands", id: runId },
      ],
    }),

    addRunCommand: builder.mutation<number, CreateRunCommandPayload>({
      query: (payload) => ({
        handler: "runCommands:add",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: number }) =>
        response.data,
      invalidatesTags: (_result, _error, { runId }) => [
        "RunCommands",
        { type: "RunCommands", id: runId },
      ],
    }),

    updateRunCommand: builder.mutation<
      void,
      { id: number; runId: string; payload: UpdateRunCommandPayload }
    >({
      query: ({ id, payload }) => ({
        handler: "runCommands:update",
        args: [id, payload],
      }),
      invalidatesTags: (_result, _error, { runId }) => [
        "RunCommands",
        { type: "RunCommands", id: runId },
      ],
    }),

    startRunCommand: builder.mutation<void, { id: number; runId: string }>({
      query: ({ id }) => ({
        handler: "runCommands:start",
        args: [id],
      }),
      invalidatesTags: (_result, _error, { runId }) => [
        "RunCommands",
        { type: "RunCommands", id: runId },
      ],
    }),

    completeRunCommand: builder.mutation<
      void,
      {
        id: number;
        runId: string;
        exitCode: number;
        stdout?: string;
        stderr?: string;
      }
    >({
      query: ({ id, exitCode, stdout, stderr }) => ({
        handler: "runCommands:complete",
        args: [id, exitCode, stdout, stderr],
      }),
      invalidatesTags: (_result, _error, { runId }) => [
        "RunCommands",
        { type: "RunCommands", id: runId },
      ],
    }),

    removeRunCommand: builder.mutation<void, { id: number; runId: string }>({
      query: ({ id }) => ({
        handler: "runCommands:remove",
        args: [id],
      }),
      invalidatesTags: (_result, _error, { runId }) => [
        "RunCommands",
        { type: "RunCommands", id: runId },
      ],
    }),
  }),
});

export const {
  // Runs
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
  useDeleteRunMutation,
  // Run Context
  useGetRunContextQuery,
  useLazyGetRunContextQuery,
  useAddRunContextMutation,
  useRemoveRunContextMutation,
  // Run Artifacts
  useGetRunArtifactsQuery,
  useLazyGetRunArtifactsQuery,
  useAddRunArtifactMutation,
  useRemoveRunArtifactMutation,
  // Run Commands
  useGetRunCommandsQuery,
  useLazyGetRunCommandsQuery,
  useAddRunCommandMutation,
  useUpdateRunCommandMutation,
  useStartRunCommandMutation,
  useCompleteRunCommandMutation,
  useRemoveRunCommandMutation,
} = runsApi;
