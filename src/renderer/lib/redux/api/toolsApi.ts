import { unwrap, type ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";

export type ToolCallStatus = "queued" | "running" | "done" | "error" | "canceled";

export interface ToolCall {
  id: number;
  accountId: string;
  runId: string | null;
  providerId: string | null;
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
    getToolCallsByRun: builder.query<ToolCall[], string>({
      query: (runId) => ({
        handler: "toolCalls:getByRun",
        args: [runId],
      }),
      transformResponse: (response: ServiceResponse<ToolCall[]>) => unwrap(response),
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
      transformResponse: (response: ServiceResponse<ToolCall[]>) => unwrap(response),
      providesTags: ["ToolCalls"],
    }),

    createToolCall: builder.mutation<number, CreateToolCallPayload>({
      query: (payload) => ({
        handler: "toolCalls:create",
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<number>) => unwrap(response),
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
