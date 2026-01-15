import { baseApi } from "./baseApi";

export interface McpTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface McpToolsResponse {
  tools: McpTool[];
}

export interface CallToolPayload {
  name: string;
  arguments?: any;
}

export interface CallToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export const mcpApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMcpTools: builder.query<McpTool[], void>({
      query: () => ({
        handler: "mcp:listTools",
      }),
      transformResponse: (response: {
        success: boolean;
        data: McpToolsResponse;
      }) => response.data.tools,
      providesTags: ["McpTools"],
    }),

    callMcpTool: builder.mutation<CallToolResponse, CallToolPayload>({
      query: (payload) => ({
        handler: "mcp:callTool",
        args: [payload],
      }),
      transformResponse: (response: {
        success: boolean;
        data: CallToolResponse;
      }) => response.data,
    }),
  }),
  overrideExisting: false,
});

export const { useListMcpToolsQuery, useCallMcpToolMutation } = mcpApi;
