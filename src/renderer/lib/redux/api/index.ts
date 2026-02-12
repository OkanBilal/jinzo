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
  useLazyGetLinearTeamsQuery,
  useLazyGetJiraProjectsQuery,
  useLazyGetAsanaProjectsQuery,
  useLazyGetSelectedReposQuery,
  useLazyGetSelectedTeamsQuery,
  useLazyGetSelectedProjectsQuery,
  useLazyGetSelectedAsanaProjectsQuery,
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
  LinearTeam,
  JiraProject,
  AsanaProject,
  SelectedRepo,
  SelectedTeam,
  SelectedProject,
  SelectedAsanaProject,
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
  entitiesApi,
  useGetEntitiesQuery,
  useLazyGetEntitiesQuery,
  useGetEntityByIdQuery,
  useLazyGetEntityByIdQuery,
  useCreateEntityMutation,
  useUpdateEntityMutation,
  useDeleteEntityMutation,
  useSearchEntitiesQuery,
  useLazySearchEntitiesQuery,
  useGetTasksQuery,
  useGetTaskByEntityIdQuery,
  useUpdateTaskStatusMutation,
  useGetIssuesQuery,
  useGetIssueByEntityIdQuery,
  useUpdateIssueStateMutation,
  useGetIssuesByRepoQuery,
  useGetPlaylistItemsQuery,
} from "./entitiesApi";
export type {
  Entity,
  EntityQueryParams,
  CreateEntityPayload,
  UpdateEntityPayload,
  Task,
  Issue,
  IssueRecord,
  IssueWithEntity,
  PlaylistItem,
} from "./entitiesApi";

export {
  feedApi,
  useGetFeedEventsQuery,
  useGetRecentFeedEventsQuery,
} from "./feedApi";
export type { FeedEvent, FeedEventQueryParams } from "./feedApi";

export {
  syncApi,
  useRunEntitySyncMutation,
} from "./syncApi";
export type { SyncStats, SyncResult } from "./syncApi";

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
  journalApi,
  useGetJournalEntriesQuery,
  useLazyGetJournalEntriesQuery,
  useGetJournalByIdQuery,
  useLazyGetJournalByIdQuery,
  useCreateJournalDraftMutation,
  useUpdateJournalDraftMutation,
  useSaveJournalMutation,
  usePublishJournalMutation,
  useDeleteJournalMutation,
  useGetJournalRevisionsQuery,
  useLazyGetJournalRevisionsQuery,
  useMarkJournalForIndexingMutation,
} from "./journalApi";
export type {
  JournalEntry,
  JournalMetadata,
  JournalRevision,
  CreateJournalDraftPayload,
  UpdateJournalDraftPayload,
  JournalQueryParams,
} from "./journalApi";

export {
  setSelectedModel,
  setThinkingLevel,
  setThinkingEnabled,
  setToolMode,
  setModelCapabilities,
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

export {
  setEditingJournal,
  updateEditingTitle,
  updateEditingBody,
  handleTitleUpdate,
  handleContentUpdate,
  clearEditingJournal,
} from "../slices/journalEditingSlice";
export type { JournalEditingState } from "../slices/journalEditingSlice";

export {
  providersApi,
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
} from "./providersApi";
export type {
  Provider,
  ProviderKind,
  ProviderConfig,
  ProviderCapabilities,
  CreateProviderPayload,
  UpdateProviderPayload,
} from "./providersApi";

export {
  toolsApi,
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
  useGetToolPermissionsByMoodQuery,
  useLazyGetToolPermissionsByMoodQuery,
  useSetToolPermissionMutation,
  useRemoveToolPermissionMutation,
} from "./toolsApi";
export type {
  Tool,
  ToolSource,
  ToolSchema,
  ToolMetadata,
  CreateToolPayload,
  UpdateToolPayload,
  ToolCall,
  ToolCallStatus,
  CreateToolCallPayload,
  UpdateToolCallPayload,
  MoodToolPermission,
  MoodToolPermissionPayload,
} from "./toolsApi";

export {
  workspacesApi,
  useGetWorkspacesQuery,
  useLazyGetWorkspacesQuery,
  useGetWorkspaceByIdQuery,
  useLazyGetWorkspaceByIdQuery,
  useGetWorkspacesByAccountQuery,
  useLazyGetWorkspacesByAccountQuery,
  useGetWorkspaceByRootPathQuery,
  useLazyGetWorkspaceByRootPathQuery,
  useCreateWorkspaceMutation,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useSelectDirectoryMutation,
} from "./workspacesApi";
export type {
  Workspace,
  WorkspaceMetadata,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
} from "./workspacesApi";

export {
  runsApi,
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
  useGetRunContextQuery,
  useLazyGetRunContextQuery,
  useAddRunContextMutation,
  useRemoveRunContextMutation,
  useGetRunArtifactsQuery,
  useLazyGetRunArtifactsQuery,
  useAddRunArtifactMutation,
  useRemoveRunArtifactMutation,
  useGetRunCommandsQuery,
  useLazyGetRunCommandsQuery,
  useAddRunCommandMutation,
  useUpdateRunCommandMutation,
  useStartRunCommandMutation,
  useCompleteRunCommandMutation,
  useRemoveRunCommandMutation,
} from "./runsApi";
export type {
  Run,
  RunStatus,
  CreateRunPayload,
  UpdateRunPayload,
  RunContext,
  RunContextKind,
  CreateRunContextPayload,
  RunArtifact,
  RunArtifactKind,
  CreateRunArtifactPayload,
  RunCommand,
  RunCommandStatus,
  CreateRunCommandPayload,
  UpdateRunCommandPayload,
} from "./runsApi";

export {
  workspaceResourcesApi,
  useGetWorkspaceResourcesQuery,
  useGetAvailableResourcesQuery,
  useLazyGetAvailableResourcesQuery,
  useAddWorkspaceResourceMutation,
  useRemoveWorkspaceResourceMutation,
  useGetIssuesByWorkspaceQuery,
} from "./workspaceResourcesApi";
export type {
  WorkspaceResource,
  WorkspaceResourceWithDetails,
  AvailableResource,
  WorkspaceIssue,
} from "./workspaceResourcesApi";
