export { baseApi } from "./baseApi";

export {
  appsApi,
  useGetAppsQuery,
  useUpdateAppConnectionMutation,
} from "./appsApi";
export type { AppState, UpdateAppConnectionPayload } from "./appsApi";

export {
  accountApi,
  useGetAccountQuery,
  useUpdateAccountMutation,
} from "./accountApi";
export type { Account, UpdateAccountPayload } from "./accountApi";

export {
  connectionsApi,
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetGitHubReposQuery,
  useLazyGetRaindropCollectionsQuery,
  useLazyGetSelectedReposQuery,
  useLazyGetSelectedCollectionsQuery,
  useLazyGetSelectedPodcastsQuery,
  useLazyGetHackerNewsStatusQuery,
  useUpdateHackerNewsSettingsMutation,
  useLazyGetRssStatusQuery,
  useUpdateRssSettingsMutation,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
} from "./connectionsApi";
export type {
  Connection,
  GitHubRepo,
  RaindropCollection,
  SelectedRepo,
  SelectedCollection,
  SelectedPodcast,
  HackerNewsSettings,
  HackerNewsStatus,
  UpdateHackerNewsPayload,
  RssFeed,
  RssStatus,
  UpdateRssPayload,
  SaveCredentialsPayload,
  SaveResourcesPayload,
} from "./connectionsApi";

export {
  chatApi,
  useGetChatConfigQuery,
  useUpdateChatConfigMutation,
  useCreateChatSessionMutation,
  useGetChatSessionQuery,
  useGetChatMessagesQuery,
  useGetChatSessionsQuery,
  useDeleteChatSessionMutation,
  useUpdateChatSessionTitleMutation,
  useGenerateChatSessionTitleMutation,
} from "./chatApi";
export type {
  ChatSession,
  ChatMessage,
  CreateSessionPayload,
  ChatConfig,
  StructuredOutputProperty,
  StructuredOutputSchema,
} from "./chatApi";

export {
  feedApi,
  useGetFeedItemsQuery,
  useGetCombinedFeedQuery,
  useRunFeedSyncMutation,
} from "./feedApi";
export type { FeedSource, FeedQueryParams } from "./feedApi";

export {
  ollamaApi,
  useGetOllamaModelsQuery,
  useCheckOllamaStatusQuery,
} from "./ollamaApi";
export type { OllamaModel, OllamaModelsResponse } from "./ollamaApi";

export {
  moodApi,
  useGetMoodsQuery,
  useGetMoodByIdQuery,
  useLazyGetMoodByIdQuery,
  useCreateMoodMutation,
  useUpdateMoodMutation,
  useDeleteMoodMutation,
  useArchiveMoodMutation,
} from "./moodApi";
export type { Mood, CreateMoodPayload, UpdateMoodPayload } from "./moodApi";

export {
  appSettingsApi,
  useGetAppSettingsQuery,
  useLazyGetAppSettingsQuery,
  useSetActiveMoodMutation,
} from "./appSettingsApi";
export type { AppSettings } from "./appSettingsApi";

export {
  mcpApi,
  useListMcpToolsQuery,
  useCallMcpToolMutation,
} from "./mcpApi";
export type { McpTool, McpToolsResponse, CallToolPayload, CallToolResponse } from "./mcpApi";

export {
  cronApi,
  useRunFeedSyncMutation as useCronRunFeedSyncMutation,
} from "./cronApi";
export type { CronSyncStats, CronSyncResult } from "./cronApi";

export {
  setSelectedModel,
  setThinkingLevel,
  setThinkingEnabled,
  setToolMode,
  setModelCapabilities,
  setStructuredOutputEnabled,
  setStructuredOutputSchema,
} from "../slices/chatSlice";
export type { ChatState, ModelCapabilities } from "../slices/chatSlice";

export {
  setActiveMoodId,
  setSelectedMoodForEdit,
} from "../slices/moodSlice";
export type { MoodState } from "../slices/moodSlice";

export {
  setDarkMode,
  setSidebarCollapsed,
  setFontSize,
} from "../slices/appSettingsSlice";
export type { AppSettingsState } from "../slices/appSettingsSlice";
