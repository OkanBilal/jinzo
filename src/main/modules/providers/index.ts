export { registerProvidersIpc, unregisterProvidersIpc } from "./providers.ipc";
export { providersController } from "./providers.controller";
export { providersService } from "./providers.service";
export { providersRepo } from "./providers.repo";
export type {
  ProviderKind,
  ProviderConfig,
  ProviderCapabilities,
  CreateProviderPayload,
  UpdateProviderPayload,
  ProviderResponse,
  ProviderListResponse,
  ServiceResponse,
} from "./providers.dto";

// Adapters
export {
  createWorkAdapter,
  getWorkAdapter,
  shutdownWorkAdapter,
  shutdownAllWorkAdapters,
  clearAdapterCache,
  isSupportedWorkProvider,
  SUPPORTED_WORK_PROVIDERS,
  createCopilotAdapter,
  createClaudeAdapter,
} from "./adapters";

export type {
  WorkRunContextItem,
  WorkRunRequest,
  WorkRunLogEvent,
  WorkRunToolCallEvent,
  WorkRunCommandEvent,
  WorkRunArtifactEvent,
  WorkRunStatusEvent,
  WorkRunEvent,
  WorkRunArtifactSummary,
  WorkRunResult,
  WorkRunEventHandler,
  WorkRunAdapter,
  CopilotAdapterConfig,
  ClaudeCodeAdapterConfig,
  SupportedWorkProvider,
} from "./adapters";
