export { baseApi } from "./baseApi";

export {
  connectionStatesApi,
  useGetConnectionStatesQuery,
  useUpdateConnectionStatesMutation,
} from "./connectionStates";
export type { ConnectionStates, UpdateConnectionStatesPayload } from "./connectionStates";

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
  useLazyGetLinearTeamsQuery,
  useLazyGetJiraProjectsQuery,
  useLazyGetAsanaProjectsQuery,
  useLazyGetGitLabProjectsQuery,
  useLazyGetTrelloBoardsQuery,
  useLazyGetSelectedReposQuery,
  useLazyGetSelectedTeamsQuery,
  useLazyGetSelectedProjectsQuery,
  useLazyGetSelectedAsanaProjectsQuery,
  useLazyGetSelectedGitLabProjectsQuery,
  useLazyGetSelectedTrelloBoardsQuery,
  useLazyGetSentryProjectsQuery,
  useGetSelectedSentryProjectsQuery,
  useLazyGetSelectedSentryProjectsQuery,
  useLazyGetSocketDevOrganizationsQuery,
  useGetSelectedSocketDevOrganizationsQuery,
  useLazyGetSelectedSocketDevOrganizationsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
} from "./connectionsApi";
export type {
  Connection,
  GitHubRepo,
  GitLabProject,
  LinearTeam,
  JiraProject,
  AsanaProject,
  TrelloBoard,
  SelectedRepo,
  SelectedTeam,
  SelectedProject,
  SelectedAsanaProject,
  SelectedGitLabProject,
  SelectedTrelloBoard,
  SentryProject,
  SelectedSentryProject,
  SocketDevOrganization,
  SelectedSocketDevOrganization,
  SaveCredentialsPayload,
  SaveResourcesPayload,
} from "./connectionsApi";


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
} from "./entitiesApi";


export {
  syncApi,
  useRunEntitySyncMutation,
} from "./syncApi";
export type { SyncStats, SyncResult } from "./syncApi";


export {
  spaceApi,
  useGetSpacesQuery,
  useGetSpaceByIdQuery,
  useLazyGetSpaceByIdQuery,
  useCreateSpaceMutation,
  useUpdateSpaceMutation,
  useDeleteSpaceMutation,
  useArchiveSpaceMutation,
  useUnarchiveSpaceMutation,
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
  useSetShowMenuBarIconMutation,
  useSetCommitInstructionsMutation,
  useSetPrInstructionsMutation,
} from "./appSettingsApi";
export type { AppSettings } from "./appSettingsApi";



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
  useGetProviderAccountInfoQuery,
  useGetProviderPluginsQuery,
  useReadProviderPluginQuery,
  useInstallProviderPluginMutation,
  useUninstallProviderPluginMutation,
  useGetProviderRateLimitsQuery,
} from "./providersApi";
export type {
  Provider,
  ProviderKind,
  ProviderConfig,
  ProviderCapabilities,
  CreateProviderPayload,
  UpdateProviderPayload,
  RateLimitInfo,
  PluginInfo,
  PluginInterfaceInfo,
  PluginListResponse,
  CodexAccountInfo,
  MarketplaceInfo,
  PluginDetailResponse,
  PluginSkillSummary,
  PluginAppSummary,
} from "./providersApi";

export {
  toolsApi,
  useGetToolCallsByRunQuery,
  useLazyGetToolCallsByRunQuery,
  useGetToolCallsByAccountQuery,
  useLazyGetToolCallsByAccountQuery,
  useCreateToolCallMutation,
  useUpdateToolCallMutation,
  useStartToolCallMutation,
  useCompleteToolCallMutation,
  useFailToolCallMutation,
} from "./toolsApi";
export type {
  ToolCall,
  ToolCallStatus,
  CreateToolCallPayload,
  UpdateToolCallPayload,
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
  useExecuteReviewMutation,
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

export {
  signalsApi,
  useGetSignalsByProjectQuery,
} from "./signalsApi";
export type {
  SignalRecord,
  SignalWithEntity,
  SignalQueryOptions,
} from "./signalsApi";

export {
  guardsApi,
  useGetActiveGuardQuery,
  useCheckPackageMutation,
  useCheckPackagesMutation,
  useGetPackageScoreQuery,
  useLazyGetPackageScoreQuery,
  useScanWorkspaceMutation,
} from "./guardsApi";
export type {
  PackageIdentifier,
  PackageAlert,
  PackageScore,
  PackageCheckResult,
  ManifestScanResult,
  ScanSummary,
  ActiveGuardInfo,
} from "./guardsApi";

export {
  automationsApi,
  useGetAutomationsQuery,
  useLazyGetAutomationsQuery,
  useCreateAutomationMutation,
  useUpdateAutomationMutation,
  useDeleteAutomationMutation,
} from "./automationsApi";
export type {
  Automation,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "./automationsApi";
