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
  useLazyGetGitLabProjectsQuery,
  useLazyGetSelectedReposQuery,
  useLazyGetSelectedTeamsQuery,
  useLazyGetSelectedProjectsQuery,
  useLazyGetSelectedAsanaProjectsQuery,
  useLazyGetSelectedGitLabProjectsQuery,
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
  GitLabProject,
  RaindropCollection,
  LinearTeam,
  JiraProject,
  AsanaProject,
  SelectedRepo,
  SelectedTeam,
  SelectedProject,
  SelectedAsanaProject,
  SelectedGitLabProject,
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
  spaceApi,
  useGetSpacesQuery,
  useGetSpaceByIdQuery,
  useLazyGetSpaceByIdQuery,
  useCreateSpaceMutation,
  useUpdateSpaceMutation,
  useDeleteSpaceMutation,
  useArchiveSpaceMutation,
} from "./spaceApi";
export type { Space, CreateSpacePayload, UpdateSpacePayload } from "./spaceApi";

export {
  appSettingsApi,
  useGetAppSettingsQuery,
  useLazyGetAppSettingsQuery,
  useSetActiveSpaceMutation,
  useSetEnableWorktreesMutation,
  useSetShowToolCallsMutation,
  useSetPreventSleepDuringRunsMutation,
  useSetNotifyOnRunCompleteMutation,
  useSetNotifyOnToolApprovalMutation,
  useSetCommitInstructionsMutation,
  useSetPrInstructionsMutation,
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
  setActiveSpaceId,
  setSelectedSpaceForEdit,
} from "../slices/spaceSlice";
export type { SpaceState } from "../slices/spaceSlice";

export {
  setDarkMode,
  setSidebarCollapsed,
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
  useGetToolPermissionsBySpaceQuery,
  useLazyGetToolPermissionsBySpaceQuery,
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
  SpaceToolPermission,
  SpaceToolPermissionPayload,
} from "./toolsApi";

export {
  projectsApi,
  useGetProjectsQuery,
  useLazyGetProjectsQuery,
  useGetProjectByIdQuery,
  useLazyGetProjectByIdQuery,
  useGetProjectsByAccountQuery,
  useLazyGetProjectsByAccountQuery,
  useFindProjectByRemoteOriginQuery,
  useLazyFindProjectByRemoteOriginQuery,
  useFindOrCreateProjectMutation,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useRemoveProjectMutation,
  useDeleteProjectMutation,
  useArchiveProjectMutation,
} from "./projectsApi";
export type {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
} from "./projectsApi";

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
  useArchiveWorkspaceMutation,
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
  RunTurn,
  RunTurnStatus,
  ModelUsageEntry,
} from "./runsApi";

export {
  workspaceDiffsApi,
  useGetLatestWorkspaceDiffQuery,
  useLazyGetLatestWorkspaceDiffQuery,
  useGetWorkspaceDiffsQuery,
  useLazyGetWorkspaceDiffsQuery,
} from "./workspaceDiffsApi";
export type { WorkspaceDiff } from "./workspaceDiffsApi";

export {
  reviewsApi,
  useGetReviewsByWorkspaceQuery,
  useGetReviewByIdQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
} from "./reviewsApi";
export type {
  Review,
  ReviewStatus,
  CreateReviewPayload,
  UpdateReviewPayload,
} from "./reviewsApi";

export {
  projectResourcesApi,
  useGetProjectResourcesQuery,
  useGetAvailableResourcesQuery,
  useLazyGetAvailableResourcesQuery,
  useAddProjectResourceMutation,
  useRemoveProjectResourceMutation,
  useGetIssuesByProjectQuery,
} from "./workspaceResourcesApi";
export type {
  ProjectResource,
  ProjectResourceWithDetails,
  AvailableResource,
  ProjectIssue,
} from "./workspaceResourcesApi";

export {
  updatesApi,
  useGetUpdateStatusQuery,
  useCheckForUpdatesMutation,
  useDownloadUpdateMutation,
  useInstallUpdateMutation,
} from "./updatesApi";
export type {
  UpdateStatus,
  UpdateInfo,
  UpdateProgress,
  UpdateState,
} from "./updatesApi";

export {
  shellApi,
  useGetInstalledAppsQuery,
} from "./shellApi";
export type { InstalledApp } from "./shellApi";

export {
  reviewFindingsApi,
  useGetReviewFindingsByWorkspaceQuery,
  useGetReviewFindingsByReviewQuery,
  useGetReviewFindingByIdQuery,
  useCreateReviewFindingMutation,
  useCreateReviewFindingsMutation,
  useUpdateReviewFindingMutation,
  useDeleteReviewFindingMutation,
} from "./reviewFindingsApi";
export type {
  ReviewFinding,
  FindingSeverity,
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
} from "./reviewFindingsApi";

export {
  workspaceActivityApi,
  useGetWorkspaceActivityQuery,
  useCreateWorkspaceActivityMutation,
  useDeleteWorkspaceActivityMutation,
} from "./workspaceActivityApi";
export type {
  WorkspaceActivity,
  ActivityType,
  CreateWorkspaceActivityPayload,
} from "./workspaceActivityApi";

export {
  statsApi,
  useGetDashboardQuery,
  useLazyGetDashboardQuery,
} from "./statsApi";
export type {
  DashboardData,
  DashboardSummary,
  DailyActivity,
  HourDistribution,
  CostByModel,
  ToolUsageItem,
  StatusBreakdownDay,
  StatusBreakdown,
  RecentSession,
  CodeActivityStats,
  ProviderFilter,
} from "./statsApi";
