export { baseApi } from "./baseApi";

export {
  accountApi,
  useGetAccountQuery,
  useUpdateAccountMutation,
} from "./accountApi";
export type { Account, UpdateAccountPayload } from "./accountApi";

// Connections aggregate (identity + integration state + credentials + per-provider resource discovery).
// See ADR-0002.
export {
  connectionsApi,
  useGetConnectionStatesQuery,
  useUpdateConnectionStateMutation,
  useGetConnectionQuery,
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useRevokeConnectionMutation,
  useLazyGetGitHubReposQuery,
  useLazyGetLinearTeamsQuery,
  useLazyGetJiraProjectsQuery,
  useLazyGetAsanaProjectsQuery,
  useLazyGetGitLabProjectsQuery,
  useLazyGetTrelloBoardsQuery,
  useLazyGetSentryProjectsQuery,
  useLazyGetSocketDevOrganizationsQuery,
  useGetSelectedResourcesQuery,
  useLazyGetSelectedResourcesQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
} from "./connectionsApi";
export type {
  Connection,
  ConnectionState,
  UpdateConnectionStatePayload,
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
  useUpdateAppSettingsMutation,
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
export type { AppSettings, AppSettingsPatch } from "./appSettingsApi";



export {
  setSidebarCollapsed,
  setBrowserPanelOpen,
  setRightPanelOpen,
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
  useUpdateProviderCliMutation,
  useGetProviderPluginsQuery,
  useGetProviderInstalledPluginsQuery,
  useReadProviderPluginQuery,
  useInstallProviderPluginMutation,
  useUninstallProviderPluginMutation,
  useSetProviderPluginEnabledMutation,
  useUpdateProviderPluginMutation,
  useGetProviderRateLimitsQuery,
  useGetProviderModelsQuery,
  useDetectInstalledClisQuery,
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
  PluginScope,
  AccountInfo,
  MarketplaceInfo,
  PluginDetailResponse,
  PluginSkillSummary,
  PluginAppSummary,
  DetectedClis,
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

// Projects aggregate (projects + projectResources + linked issues)
// Replaces the legacy workspaceResourcesApi.
export {
  projectsApi,
  // lifecycle
  useListProjectsQuery,
  useLazyListProjectsQuery,
  useGetProjectQuery,
  useLazyGetProjectQuery,
  useListProjectBranchesQuery,
  useListProjectsByAccountQuery,
  useLazyListProjectsByAccountQuery,
  useFindProjectByRemoteOriginQuery,
  useLazyFindProjectByRemoteOriginQuery,
  useFindOrCreateProjectMutation,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useRemoveProjectMutation,
  useDeleteProjectMutation,
  useArchiveProjectMutation,
  // resources
  useListProjectResourcesQuery,
  useListAvailableResourcesQuery,
  useLazyListAvailableResourcesQuery,
  useAddProjectResourceMutation,
  useRemoveProjectResourceMutation,
  // issues (via linked resources)
  useListProjectIssuesQuery,
} from "./projectsApi";
export type {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  ProjectResource,
  ProjectResourceWithDetails,
  AvailableResource,
  ProjectIssue,
} from "./projectsApi";

// Workspace aggregate (workspace + activity + diffs + reviews + findings)
// Replaces 5 legacy api files; see ADR-0001.
export {
  workspaceApi,
  // workspace lifecycle
  useListWorkspacesQuery,
  useLazyListWorkspacesQuery,
  useListWorkspaceGitStatesQuery,
  useGetWorkspaceQuery,
  useLazyGetWorkspaceQuery,
  useListWorkspacesByAccountQuery,
  useLazyListWorkspacesByAccountQuery,
  useGetWorkspaceByRootPathQuery,
  useLazyGetWorkspaceByRootPathQuery,
  useCreateWorkspaceMutation,
  useCreateWorkspaceFromSourceMutation,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useArchiveWorkspaceMutation,
  useSelectWorkspaceDirectoryMutation,
  useRenameWorkspaceBranchMutation,
  useSwitchWorkspaceBranchMutation,
  useDiscardWorkspacePathsMutation,
  // activity
  useListWorkspaceActivityQuery,
  useCreateWorkspaceActivityMutation,
  useDeleteWorkspaceActivityMutation,
  // diffs
  useGetLatestWorkspaceDiffQuery,
  useLazyGetLatestWorkspaceDiffQuery,
  useGetLatestWorkspaceDiffSummaryQuery,
  useLazyGetLatestWorkspaceDiffSummaryQuery,
  useListWorkspaceDiffsQuery,
  useLazyListWorkspaceDiffsQuery,
  useResyncWorkspaceDiffMutation,
  // reviews
  useListReviewsByWorkspaceQuery,
  useGetReviewQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  // findings
  useListReviewFindingsByWorkspaceQuery,
  useListReviewFindingsByReviewQuery,
  useGetReviewFindingQuery,
  useCreateReviewFindingMutation,
  useCreateReviewFindingsMutation,
  useUpdateReviewFindingMutation,
  useDeleteReviewFindingMutation,
} from "./workspaceApi";
export type {
  Workspace,
  WorkspaceGitState,
  WorkspaceMetadata,
  WorkspaceStatus,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceIntakeSource,
  WorkspaceIntakePayload,
  WorkspaceActivity,
  ActivityType,
  CreateWorkspaceActivityPayload,
  WorkspaceDiff,
  WorkspaceDiffSummary,
  Review,
  ReviewStatus,
  CreateReviewPayload,
  UpdateReviewPayload,
  ReviewFinding,
  FindingSeverity,
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
} from "./workspaceApi";

export {
  gitFlowApi,
  useGetGitFlowStatusQuery,
  useCommitGitFlowMutation,
  usePushGitFlowMutation,
  useCreatePrGitFlowMutation,
  useGenerateCommitMessageGitFlowMutation,
  useGeneratePrBodyGitFlowMutation,
  useGetPublishPreflightQuery,
  usePublishRepoMutation,
} from "./gitFlowApi";
export type {
  GitFlowStatus,
  ChangedFile,
  CommitResult,
  CommitGitFlowPayload,
  CreatePrGitFlowPayload,
  PublishPreflight,
  PublishResult,
  PublishRepoPayload,
} from "./gitFlowApi";

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
  useLazyGetAppsForFileQuery,
} from "./shellApi";
export type { InstalledApp, FileHandlerApp } from "./shellApi";

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

export {
  pulseApi,
  useGetPulsesQuery,
  useLazyGetPulsesQuery,
  useGetPulseByIdQuery,
  useCreatePulseMutation,
  useUpdatePulseMutation,
  useDeletePulseMutation,
  useTogglePulseMutation,
  useRunPulseNowMutation,
} from "./pulseApi";
export type {
  Pulse,
  PulseFrequency,
  CreatePulseInput,
  UpdatePulseInput,
} from "./pulseApi";
