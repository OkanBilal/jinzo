import { baseApi } from "./baseApi";

export type ProviderKind = "llm_runtime" | "agent_runtime";

export interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  [key: string]: unknown;
}

export interface ProviderCapabilities {
  streaming?: boolean;
  functionCalling?: boolean;
  vision?: boolean;
  embeddings?: boolean;
  [key: string]: unknown;
}

export interface Provider {
  id: string;
  kind: ProviderKind;
  displayName: string;
  isEnabled: boolean;
  config: ProviderConfig | null;
  capabilities: ProviderCapabilities | null;
  defaultModel: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProviderPayload {
  id: string;
  kind: ProviderKind;
  displayName: string;
  isEnabled?: boolean;
  config?: ProviderConfig;
  capabilities?: ProviderCapabilities;
  defaultModel?: string;
}

export interface UpdateProviderPayload {
  displayName?: string;
  isEnabled?: boolean;
  config?: ProviderConfig;
  capabilities?: ProviderCapabilities;
  defaultModel?: string;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  version?: string;
  isDefault?: boolean;
  capabilities?: {
    streaming?: boolean;
    vision?: boolean;
    functionCalling?: boolean;
    reasoning?: boolean;
  };
  contextWindow?: number;
  metadata?: Record<string, unknown>;
}

export interface CommandInfo {
  name: string;
  description?: string;
  argumentHint?: string;
  userFacing?: boolean;
}

/**
 * Skill information for Claude Agent SDK skills
 * Skills are SKILL.md files that extend Claude's capabilities
 */
export interface SkillInfo {
  /** Skill name (e.g., "explain-code", "deploy") */
  name: string;
  /** Human-readable description of what the skill does */
  description?: string;
  /** Hint for skill arguments (from argument-hint frontmatter) */
  argumentHint?: string;
  /** Whether the skill is user-invocable (can be triggered with /name). Default: true */
  userInvocable?: boolean;
  /** Whether Claude can automatically invoke this skill. Default: true */
  modelInvocable?: boolean;
  /** Source location: "user" (~/.claude/skills/) or "project" (.claude/skills/) */
  source?: "user" | "project";
  /** Model to use when skill is active */
  model?: string;
  /** Whether skill runs in forked subagent context (context: fork) */
  forked?: boolean;
  /** Agent type for forked context */
  agent?: string;
  /** Full path to the SKILL.md file */
  path?: string;
}

export const providersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProviders: builder.query<Provider[], void>({
      query: () => ({
        handler: "providers:getAll",
      }),
      transformResponse: (response: { success: boolean; data: Provider[] }) =>
        response.data,
      providesTags: ["Providers"],
    }),

    getProviderById: builder.query<Provider, string>({
      query: (id) => ({
        handler: "providers:getById",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: Provider }) =>
        response.data,
      providesTags: (_result, _error, id) => [{ type: "Providers", id }],
    }),

    getProvidersByKind: builder.query<Provider[], ProviderKind>({
      query: (kind) => ({
        handler: "providers:getByKind",
        args: [kind],
      }),
      transformResponse: (response: { success: boolean; data: Provider[] }) =>
        response.data,
      providesTags: ["Providers"],
    }),

    getEnabledProviders: builder.query<Provider[], void>({
      query: () => ({
        handler: "providers:getEnabled",
      }),
      transformResponse: (response: { success: boolean; data: Provider[] }) =>
        response.data,
      providesTags: ["Providers"],
    }),

    createProvider: builder.mutation<string, CreateProviderPayload>({
      query: (payload) => ({
        handler: "providers:create",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: string }) =>
        response.data,
      invalidatesTags: ["Providers"],
    }),

    updateProvider: builder.mutation<
      Provider,
      { id: string; payload: UpdateProviderPayload }
    >({
      query: ({ id, payload }) => ({
        handler: "providers:update",
        args: [id, payload],
      }),
      transformResponse: (response: { success: boolean; data: Provider }) =>
        response.data,
      invalidatesTags: (_result, _error, { id }) => [
        "Providers",
        { type: "Providers", id },
      ],
    }),

    deleteProvider: builder.mutation<void, string>({
      query: (id) => ({
        handler: "providers:delete",
        args: [id],
      }),
      invalidatesTags: ["Providers"],
    }),

    enableProvider: builder.mutation<void, string>({
      query: (id) => ({
        handler: "providers:enable",
        args: [id],
      }),
      invalidatesTags: (_result, _error, id) => [
        "Providers",
        { type: "Providers", id },
      ],
    }),

    disableProvider: builder.mutation<void, string>({
      query: (id) => ({
        handler: "providers:disable",
        args: [id],
      }),
      invalidatesTags: (_result, _error, id) => [
        "Providers",
        { type: "Providers", id },
      ],
    }),

    getProviderModels: builder.query<ModelInfo[], string>({
      query: (id) => ({
        handler: "providers:getModels",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: ModelInfo[]; error?: string }) => {
        if (!response.success) {
          throw new Error(response.error || "Failed to get models");
        }
        return response.data;
      },
      providesTags: (_result, _error, id) => [{ type: "ProviderModels", id }],
    }),

    getProviderCommands: builder.query<CommandInfo[], string>({
      query: (id) => ({
        handler: "providers:getCommands",
        args: [id],
      }),
      transformResponse: (response: { success: boolean; data: CommandInfo[]; error?: string }) => {
        if (!response.success) {
          throw new Error(response.error || "Failed to get commands");
        }
        return response.data;
      },
      providesTags: (_result, _error, id) => [{ type: "ProviderCommands", id }],
    }),

    getProviderSkills: builder.query<SkillInfo[], { id: string; workspacePath?: string }>({
      query: ({ id, workspacePath }) => ({
        handler: "providers:getSkills",
        args: [id, workspacePath],
      }),
      transformResponse: (response: { success: boolean; data: SkillInfo[]; error?: string }) => {
        if (!response.success) {
          throw new Error(response.error || "Failed to get skills");
        }
        return response.data;
      },
      providesTags: (_result, _error, { id }) => [{ type: "ProviderSkills", id }],
    }),
  }),
});

export const {
  useGetProvidersQuery,
  useLazyGetProvidersQuery,
  useGetProviderByIdQuery,
  useLazyGetProviderByIdQuery,
  useGetProvidersByKindQuery,
  useLazyGetProvidersByKindQuery,
  useGetEnabledProvidersQuery,
  useLazyGetEnabledProvidersQuery,
  useCreateProviderMutation,
  useUpdateProviderMutation,
  useDeleteProviderMutation,
  useEnableProviderMutation,
  useDisableProviderMutation,
  useGetProviderModelsQuery,
  useLazyGetProviderModelsQuery,
  useGetProviderCommandsQuery,
  useLazyGetProviderCommandsQuery,
  useGetProviderSkillsQuery,
  useLazyGetProviderSkillsQuery,
} = providersApi;
