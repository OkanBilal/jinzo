import { baseApi } from "./baseApi";

export type ToolSource = "local" | "mcp" | "provider_builtin";
export type ToolCallStatus = "queued" | "running" | "done" | "error" | "canceled";

export interface ToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolMetadata {
  author?: string;
  version?: string;
  category?: string;
  [key: string]: unknown;
}

export interface Tool {
  id: string;
  source: ToolSource;
  name: string;
  description: string | null;
  version: string | null;
  isEnabled: boolean;
  schema: ToolSchema | null;
  mcpServerId: string | null;
  metadata: ToolMetadata | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateToolPayload {
  id: string;
  source: ToolSource;
  name: string;
  description?: string;
  version?: string;
  isEnabled?: boolean;
  schema?: ToolSchema;
  mcpServerId?: string;
  metadata?: ToolMetadata;
}

export interface UpdateToolPayload {
  name?: string;
  description?: string;
  version?: string;
  isEnabled?: boolean;
  schema?: ToolSchema;
  metadata?: ToolMetadata;
}

export interface ToolCall {
  id: number;
  accountId: string;
  runId: string | null;
  providerId: string | null;
  toolId: string | null;
  toolName: string;
  status: ToolCallStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: number | null;
  endedAt: number | null;
  latencyMs: number | null;
  costMicros: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface CreateToolCallPayload {
  accountId: string;
  runId?: string;
  providerId?: string;
  toolId?: string;
  toolName: string;
  status?: ToolCallStatus;
  input?: Record<string, unknown>;
}

export interface UpdateToolCallPayload {
  status?: ToolCallStatus;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: number;
  endedAt?: number;
  latencyMs?: number;
  costMicros?: number;
  metadata?: Record<string, unknown>;
}

export const toolsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Tools
    getTools: builder.query<Tool[], void>({
      query: () => ({
        handler: "tools:getAll",
      }),
      transformResponse: (response: { success: boolean; data: Tool[] }) =>
        response.data,
      providesTags: ["Tools"],
    }),

    getToolById: builder.query<Tool, string>({
      query: (id) => ({
        handler: "tools:getById",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Tool }) =>
        response.data,
      providesTags: (_result, _error, id) => [{ type: "Tools", id }],
    }),

    getToolsBySource: builder.query<Tool[], ToolSource>({
      query: (source) => ({
        handler: "tools:getBySource",
        args: [source],
      }),
      transformResponse: (response: { success: boolean; data: Tool[] }) =>
        response.data,
      providesTags: ["Tools"],
    }),

    getToolsByMcpServer: builder.query<Tool[], string>({
      query: (mcpServerId) => ({
        handler: "tools:getByMcpServer",
        args: [mcpServerId],
      }),
      transformResponse: (response: { success: boolean; data: Tool[] }) =>
        response.data,
      providesTags: ["Tools"],
    }),

    getEnabledTools: builder.query<Tool[], void>({
      query: () => ({
        handler: "tools:getEnabled",
      }),
      transformResponse: (response: { success: boolean; data: Tool[] }) =>
        response.data,
      providesTags: ["Tools"],
    }),

    createTool: builder.mutation<string, CreateToolPayload>({
      query: (payload) => ({
        handler: "tools:create",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: string }) =>
        response.data,
      invalidatesTags: ["Tools"],
    }),

    updateTool: builder.mutation<Tool, { id: string; payload: UpdateToolPayload }>({
      query: ({ id, payload }) => ({
        handler: "tools:update",
        args: [id, payload],
      }),
      transformResponse: (response: { success: boolean; data: Tool }) =>
        response.data,
      invalidatesTags: (_result, _error, { id }) => [
        "Tools",
        { type: "Tools", id },
      ],
    }),

    deleteTool: builder.mutation<void, string>({
      query: (id) => ({
        handler: "tools:delete",
        args: [id],
      }),
      invalidatesTags: ["Tools"],
    }),

    getToolCallsByRun: builder.query<ToolCall[], string>({
      query: (runId) => ({
        handler: "toolCalls:getByRun",
        args: [runId],
      }),
      transformResponse: (response: { success: boolean; data: ToolCall[] }) =>
        response.data,
      providesTags: (_result, _error, runId) => [
        { type: "ToolCalls", id: runId },
      ],
    }),

    getToolCallsByAccount: builder.query<
      ToolCall[],
      { accountId: string; limit?: number }
    >({
      query: ({ accountId, limit }) => ({
        handler: "toolCalls:getByAccount",
        args: [accountId, limit],
      }),
      transformResponse: (response: { success: boolean; data: ToolCall[] }) =>
        response.data,
      providesTags: ["ToolCalls"],
    }),

    createToolCall: builder.mutation<number, CreateToolCallPayload>({
      query: (payload) => ({
        handler: "toolCalls:create",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: number }) =>
        response.data,
      invalidatesTags: ["ToolCalls"],
    }),

    updateToolCall: builder.mutation<
      void,
      { id: number; payload: UpdateToolCallPayload }
    >({
      query: ({ id, payload }) => ({
        handler: "toolCalls:update",
        args: [id, payload],
      }),
      invalidatesTags: ["ToolCalls"],
    }),

    startToolCall: builder.mutation<void, number>({
      query: (id) => ({
        handler: "toolCalls:start",
        args: [id],
      }),
      invalidatesTags: ["ToolCalls"],
    }),

    completeToolCall: builder.mutation<
      void,
      { id: number; output: Record<string, unknown>; latencyMs?: number }
    >({
      query: ({ id, output, latencyMs }) => ({
        handler: "toolCalls:complete",
        args: [id, output, latencyMs],
      }),
      invalidatesTags: ["ToolCalls"],
    }),

    failToolCall: builder.mutation<void, { id: number; error: string }>({
      query: ({ id, error }) => ({
        handler: "toolCalls:fail",
        args: [id, error],
      }),
      invalidatesTags: ["ToolCalls"],
    }),

  }),
});

export const {
  useGetToolsQuery,
  useLazyGetToolsQuery,
  useGetToolByIdQuery,
  useLazyGetToolByIdQuery,
  useGetToolsBySourceQuery,
  useLazyGetToolsBySourceQuery,
  useGetToolsByMcpServerQuery,
  useLazyGetToolsByMcpServerQuery,
  useGetEnabledToolsQuery,
  useLazyGetEnabledToolsQuery,
  useCreateToolMutation,
  useUpdateToolMutation,
  useDeleteToolMutation,
  useGetToolCallsByRunQuery,
  useLazyGetToolCallsByRunQuery,
  useGetToolCallsByAccountQuery,
  useLazyGetToolCallsByAccountQuery,
  useCreateToolCallMutation,
  useUpdateToolCallMutation,
  useStartToolCallMutation,
  useCompleteToolCallMutation,
  useFailToolCallMutation,
} = toolsApi;
