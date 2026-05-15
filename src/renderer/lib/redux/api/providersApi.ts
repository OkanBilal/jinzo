import { unwrap, type ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";

export interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins?: number;
  resetsAt?: number;
}

export interface RateLimitInfo {
  planType?: string;
  primary?: RateLimitWindow;
  secondary?: RateLimitWindow;
  credits?: { hasCredits: boolean; balance?: string; unlimited: boolean };
}

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
  supportsFastMode?: boolean;
  supportsEffort?: boolean;
  supportedEffortLevels?: ('low' | 'medium' | 'high' | 'max')[];
  /**
   * Provider-specific service tiers (e.g. Codex: priority/flex/default).
   * Mirrors the field on the main-process `ModelInfo`; populated from
   * `model/list` responses so the settings UI can offer a tier picker.
   */
  serviceTiers?: Array<{ id: string; name: string; description?: string }>;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CommandInfo {
  name: string;
  description?: string;
  argumentHint?: string;
  userFacing?: boolean;
}

export interface SkillInfo {
  name: string;
  description?: string;
  argumentHint?: string;
  userInvokable?: boolean;
  modelInvocable?: boolean;
  source?: "user" | "project";
  model?: string;
  forked?: boolean;
  agent?: string;
  path?: string;
  displayName?: string;
  shortDescription?: string;
  iconSmall?: string;
  iconLarge?: string;
  brandColor?: string;
  defaultPrompt?: string;
  scope?: "user" | "project" | "system" | string;
  enabled?: boolean;
}

export interface PluginInterfaceInfo {
  displayName?: string;
  shortDescription?: string;
  longDescription?: string;
  developerName?: string;
  category?: string;
  capabilities: string[];
  websiteUrl?: string;
  defaultPrompt?: string[];
  brandColor?: string;
  composerIcon?: string;
  logo?: string;
  screenshots: string[];
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  source: { type: string; path: string };
  installed: boolean;
  enabled: boolean;
  installPolicy: "NOT_AVAILABLE" | "AVAILABLE" | "INSTALLED_BY_DEFAULT";
  authPolicy: "ON_INSTALL" | "ON_USE";
  interface: PluginInterfaceInfo | null;
}

export interface MarketplaceInfo {
  name: string;
  path: string;
  interface: { displayName?: string } | null;
  plugins: PluginInfo[];
}

export interface PluginListResponse {
  marketplaces: MarketplaceInfo[];
  marketplaceLoadErrors: Array<{ marketplacePath: string; message: string }>;
  remoteSyncError: string | null;
  featuredPluginIds: string[];
}

export interface PluginSkillSummary {
  name: string;
  displayName?: string;
  path?: string;
  description?: string;
  shortDescription?: string;
  enabled: boolean;
}

export interface PluginAppSummary {
  id: string;
  name: string;
  needsAuth: boolean;
  description?: string;
  installUrl?: string;
  isAccessible?: boolean;
  isEnabled?: boolean;
}

export interface PluginDetailResponse {
  marketplaceName: string;
  marketplacePath: string;
  summary: PluginInfo;
  description: string | null;
  skills: PluginSkillSummary[];
  apps: PluginAppSummary[];
  mcpServers: string[];
}

export interface CodexAccountInfo {
  account: {
    type: "apiKey";
  } | {
    type: "chatgpt";
    email: string;
    planType: string;
  } | null;
  requiresOpenaiAuth: boolean;
}

export interface DetectedClis {
  claude: boolean;
  copilot: boolean;
  codex: boolean;
  cursor: boolean;
}

export const providersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProviders: builder.query<Provider[], void>({
      query: () => ({
        handler: "providers:getAll",
      }),
      transformResponse: (response: ServiceResponse<Provider[]>) => unwrap(response),
      providesTags: ["Providers"],
    }),

    getProviderById: builder.query<Provider, string>({
      query: (id) => ({
        handler: "providers:getById",
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<Provider>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "Providers", id }],
    }),

    getProvidersByKind: builder.query<Provider[], ProviderKind>({
      query: (kind) => ({
        handler: "providers:getByKind",
        args: [kind],
      }),
      transformResponse: (response: ServiceResponse<Provider[]>) => unwrap(response),
      providesTags: ["Providers"],
    }),

    getEnabledProviders: builder.query<Provider[], void>({
      query: () => ({
        handler: "providers:getEnabled",
      }),
      transformResponse: (response: ServiceResponse<Provider[]>) => unwrap(response),
      providesTags: ["Providers"],
    }),

    createProvider: builder.mutation<string, CreateProviderPayload>({
      query: (payload) => ({
        handler: "providers:create",
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<string>) => unwrap(response),
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
      transformResponse: (response: ServiceResponse<Provider>) => unwrap(response),
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
      transformResponse: (response: ServiceResponse<ModelInfo[]>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "ProviderModels", id }],
    }),

    getProviderCommands: builder.query<
      CommandInfo[],
      { id: string; workspacePath?: string }
    >({
      query: ({ id, workspacePath }) => ({
        handler: "providers:getCommands",
        args: [id, workspacePath],
      }),
      transformResponse: (response: ServiceResponse<CommandInfo[]>) => unwrap(response),
      providesTags: (_result, _error, { id, workspacePath }) => [
        { type: "ProviderCommands", id: `${id}:${workspacePath ?? ""}` },
      ],
    }),

    getProviderSkills: builder.query<
      SkillInfo[],
      { id: string; workspacePath?: string }
    >({
      query: ({ id, workspacePath }) => ({
        handler: "providers:getSkills",
        args: [id, workspacePath],
      }),
      transformResponse: (response: ServiceResponse<SkillInfo[]>) => unwrap(response),
      providesTags: (_result, _error, { id, workspacePath }) => [
        { type: "ProviderSkills", id: `${id}:${workspacePath ?? ""}` },
      ],
    }),

    getProviderAccountInfo: builder.query<CodexAccountInfo, string>({
      query: (id) => ({
        handler: "providers:getAccountInfo",
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<CodexAccountInfo>) =>
        response.success ? response.data : { account: null, requiresOpenaiAuth: false },
    }),

    getProviderPlugins: builder.query<PluginListResponse, string>({
      query: (id) => ({
        handler: "providers:getPlugins",
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<PluginListResponse>) => unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "ProviderPlugins", id }],
    }),

    readProviderPlugin: builder.query<
      PluginDetailResponse,
      { providerId: string; pluginName: string; marketplacePath: string }
    >({
      query: ({ providerId, pluginName, marketplacePath }) => ({
        handler: "providers:readPlugin",
        args: [providerId, pluginName, marketplacePath],
      }),
      transformResponse: (response: ServiceResponse<PluginDetailResponse>) => unwrap(response),
    }),

    installProviderPlugin: builder.mutation<void, { providerId: string; pluginId: string }>({
      query: ({ providerId, pluginId }) => ({
        handler: "providers:installPlugin",
        args: [providerId, pluginId],
      }),
      transformResponse: (response: ServiceResponse<unknown>) => {
        unwrap(response);
      },
      invalidatesTags: (_r, _e, { providerId }) => [
        { type: "ProviderPlugins", id: providerId },
        "ProviderSkills",
      ],
    }),

    uninstallProviderPlugin: builder.mutation<void, { providerId: string; pluginId: string }>({
      query: ({ providerId, pluginId }) => ({
        handler: "providers:uninstallPlugin",
        args: [providerId, pluginId],
      }),
      transformResponse: (response: ServiceResponse<unknown>) => {
        unwrap(response);
      },
      invalidatesTags: (_r, _e, { providerId }) => [
        { type: "ProviderPlugins", id: providerId },
        "ProviderSkills",
      ],
    }),

    getProviderRateLimits: builder.query<RateLimitInfo | null, string>({
      query: (id) => ({
        handler: "providers:getRateLimits",
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<RateLimitInfo | null>) =>
        response.success ? response.data : null,
    }),

    detectInstalledClis: builder.query<DetectedClis, void>({
      query: () => ({
        handler: "providers:detectInstalled",
      }),
      transformResponse: (response: ServiceResponse<DetectedClis>) =>
        response.success
          ? response.data
          : { claude: false, copilot: false, codex: false, cursor: false },
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
  useGetProviderAccountInfoQuery,
  useGetProviderPluginsQuery,
  useReadProviderPluginQuery,
  useInstallProviderPluginMutation,
  useUninstallProviderPluginMutation,
  useGetProviderRateLimitsQuery,
  useDetectInstalledClisQuery,
} = providersApi;
