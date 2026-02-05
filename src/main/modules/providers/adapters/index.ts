// ─────────────────────────────────────────────────────────────
// Provider Adapters Module
// ─────────────────────────────────────────────────────────────

// Types
export type {
  WorkRunContextItem,
  WorkRunRequest,
  WorkRunContinueRequest,
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
  ModelInfo,
  CommandInfo,
  SkillInfo,
  // Hook types
  HookEventName,
  HookInputBase,
  PreToolUseHookInput,
  PostToolUseHookInput,
  PostToolUseFailureHookInput,
  UserPromptSubmitHookInput,
  StopHookInput,
  SubagentStartHookInput,
  SubagentStopHookInput,
  PreCompactHookInput,
  PermissionRequestHookInput,
  SessionStartHookInput,
  SessionEndHookInput,
  NotificationHookInput,
  HookInput,
  HookContext,
  PreToolUseHookSpecificOutput,
  PostToolUseHookSpecificOutput,
  UserPromptSubmitHookSpecificOutput,
  SessionStartHookSpecificOutput,
  SubagentStartHookSpecificOutput,
  GenericHookSpecificOutput,
  HookSpecificOutput,
  HookOutput,
  HookCallback,
  HookMatcher,
  HooksConfig,
} from "./adapter.types";

// Factory
export {
  createWorkAdapter,
  getWorkAdapter,
  shutdownWorkAdapter,
  shutdownAllWorkAdapters,
  clearAdapterCache,
  isSupportedWorkProvider,
  listModelsForProvider,
  listCommandsForProvider,
  listSkillsForProvider,
  SUPPORTED_WORK_PROVIDERS,
  type SupportedWorkProvider,
} from "./adapter.factory";

// Adapters
export { createCopilotAdapter } from "./copilot.adapter";
export { createClaudeAdapter } from "./claude.adapter";
