export { baseApi } from "./baseApi";

export {
  appsApi,
  useGetAppsQuery,
  useUpdateAppConnectionMutation,
} from "./appsApi";
export type { AppState, UpdateAppConnectionPayload } from "./appsApi";

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
} from "./feedApi";
export type { FeedSource, FeedQueryParams } from "./feedApi";

export {
  ollamaApi,
  useGetOllamaModelsQuery,
  useCheckOllamaStatusQuery,
} from "./ollamaApi";
export type { OllamaModel, OllamaModelsResponse } from "./ollamaApi";

export {
  setSelectedModel,
  setThinkingLevel,
  setModelCapabilities,
} from "../slices/chatSlice";
export type { ChatState, ModelCapabilities } from "../slices/chatSlice";
