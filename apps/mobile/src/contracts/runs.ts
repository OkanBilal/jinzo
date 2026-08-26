/**
 * Run / turn / tool-call / workspace wire shapes — mirrors of the response DTOs
 * in `mains/src/main/modules/runs/runs.dto.ts` and `workspace/workspace.dto.ts`.
 * Only fields the phone reads are guaranteed here; anything else that arrives
 * is ignored. Dates cross the wire tagged and are revived to `Date` by the
 * codec in ws-protocol.ts.
 */

export type ModeId = "developer" | "work" | "chat";
export const MODE_IDS: readonly ModeId[] = ["developer", "work", "chat"];

/** Which experiences each provider drives — mirror of `mains/src/shared/modes.ts`. */
// Keys are mains's PROVIDER_IDS (`src/shared/provider-ids.ts`), verbatim.
const PROVIDER_MODES: Record<string, readonly ModeId[]> = {
  claude_code: MODE_IDS,
  codex: MODE_IDS,
  copilot_cli: ["developer"],
  cursor: ["developer"],
};

/** Modes a provider offers. An id outside the table is left unrestricted. */
export function providerModes(providerId: string): readonly ModeId[] {
  return PROVIDER_MODES[providerId] ?? MODE_IDS;
}

/** The desktop calls developer mode "Code" in its UI. */
export function modeLabel(mode: ModeId): string {
  switch (mode) {
    case "developer":
      return "Code";
    case "work":
      return "Work";
    case "chat":
      return "Chat";
  }
}
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type RunTurnStatus = "active" | "completed";
export type ToolCallStatus = "queued" | "running" | "done" | "error" | "canceled";

export interface RunResponse {
  id: string;
  accountId: string;
  workspaceId: string | null;
  collectionId: string | null;
  spaceId: string | null;
  providerId: string;
  mode: ModeId;
  model: string | null;
  title: string | null;
  goal: string | null;
  status: RunStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  lastError: string | null;
  stopReason: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunTurnResponse {
  id: number;
  runId: string;
  turnIndex: number;
  promptContent: string | null;
  responseContent: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  elapsedMs: number | null;
  status: RunTurnStatus;
  model: string | null;
  createdAt: Date;
}

export interface ToolCallResponse {
  id: number;
  runId: string | null;
  toolName: string;
  status: ToolCallStatus;
  input: Record<string, unknown> | null;
  output: unknown;
  error: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RunArtifactKind =
  | "patch"
  | "file"
  | "log"
  | "report"
  | "command_result"
  | "result"
  | "prompt_suggestion"
  | "image"
  | "document";

/**
 * `runArtifacts:getByRun` row. `metadata.kind` is the transcript's real
 * discriminator: "user-prompt" (a prompt), "thinking", "image",
 * "prompt_suggestion", or anything else (an assistant message).
 */
export interface RunArtifactResponse {
  id: number;
  runId: string;
  kind: RunArtifactKind;
  path: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** `space:getAll` row — a run's home: it pins the provider and the mode. */
export interface SpaceRecord {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  providerId: string;
  mode: ModeId;
  model: string | null;
  sortOrder: number | null;
  isArchived: boolean | null;
}

/** `space:update` payload — the phone only ever changes the mode. */
export interface SpaceModePayload {
  mode: ModeId;
}

/**
 * `providers:getEnabled` row (subset). `config` is the provider's settings
 * blob; the phone reads only the reasoning keys out of it (see `lib/models`).
 */
export interface ProviderSummary {
  id: string;
  displayName: string;
  isEnabled: boolean;
  config?: Record<string, unknown> | null;
}

/** Reasoning-effort levels, low → high (mirror of mains `shared/effort-levels.ts`). */
export const EFFORT_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** `providers:getModels` row — the subset of the desktop's `ModelInfo` the picker shows. */
export interface ModelInfo {
  id: string;
  displayName: string;
  description?: string;
  isDefault?: boolean;
  supportsEffort?: boolean;
  supportedEffortLevels?: EffortLevel[];
  supportsFastMode?: boolean;
}

/** `providers:modelsUpdated` push. */
export interface ProviderModelsUpdatedEvent {
  providerId: string;
}

/**
 * `providers:updateRunSettings` patch — only the keys present change.
 * `effortLevel` "" = reasoning off; `permissionMode` is one of the provider's
 * ids (see `lib/models`); `goalMode` / `planMode` are Codex-only.
 */
export interface UpdateRunSettingsPayload {
  effortLevel?: string;
  permissionMode?: string;
  fastMode?: boolean;
  goalMode?: boolean;
  planMode?: boolean;
}

/** `collections:list` row (subset). */
export interface CollectionResponse {
  id: string;
  name: string;
  icon: string | null;
  isArchived: boolean;
}

/** The subset of `runs:execute`'s payload the phone sends. */
export interface StartRunPayload {
  accountId: string;
  spaceId: string;
  providerId: string;
  goal: string;
  workspaceId?: string;
  collectionId?: string;
  model?: string;
}

export interface StartRunResponse {
  runId: string;
}

export interface WorkspaceResponse {
  id: string;
  projectId: string;
  name: string;
  rootPath: string;
  /** backlog | todo | in_progress | in_review | done | canceled | duplicate */
  status?: string;
  isArchived: boolean;
  updatedAt: Date;
}

/** `workspace:listGitStates` row, also the `workspace:gitStateChanged` push. */
export interface WorkspaceGitState {
  workspaceId: string;
  branch: string | null;
  /** False once the workspace's folder is gone from disk. */
  pathExists: boolean;
}

/** `workspace:getLatestDiffSummary` — the last diff snapshot, without its text. */
export interface WorkspaceDiffSummary {
  id: string;
  workspaceId: string;
  runId: string | null;
  /** `shortstat` is git's "3 files changed, 286 insertions(+), 5 deletions(-)". */
  stats: { shortstat: string; files: number; newFiles?: number } | null;
  createdAt: Date;
}

/** `projects:list` row (subset) — a workspace's parent, named and iconed. */
export interface ProjectResponse {
  id: string;
  name: string;
  icon: string | null;
  isArchived?: boolean;
}

// ── Push events (payload shapes from mains's preload `runs.on*` listeners) ──

/** `runs:diffUpdated` push — the Mac snapshotted a workspace's diff for a run. */
export interface RunDiffUpdatedEvent {
  runId: string;
  workspaceId: string | null;
  ts: number;
}

export interface RunStatusChangedEvent {
  runId: string;
  status: string;
  ts: number;
}

export interface RunEventPersistedEvent {
  runId: string;
  ts: number;
}

export interface RunUpdatedEvent {
  runId: string;
  ts: number;
}

// ── Approvals (mirror of runs.dto.ts ToolApprovalRequest / PendingApproval) ──

export type ApprovalKind = "tool_approval" | "ask_user" | "elicitation";

/** The `runs:toolApprovalRequest` push — an agent waiting on the user. */
export interface ToolApprovalRequest {
  requestId: string;
  runId: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  kind: ApprovalKind;
  header?: string;
  question?: string;
  options?: { label: string; description?: string }[];
  multiSelect?: boolean;
  /** The question also accepts a free-form "Other" answer. */
  isOther?: boolean;
  isSecret?: boolean;
  /** Provider-requested timeout before the question auto-resolves. */
  autoResolutionMs?: number;
  serverName?: string;
  elicitationMode?: "form" | "url";
  url?: string;
  description?: string;
  timestamp: number;
}

/** `runs:listPendingApprovals` row: the request plus when the Mac auto-denies it. */
export interface PendingApproval extends ToolApprovalRequest {
  expiresAt: number;
}

export interface ToolApprovalResolvedEvent {
  requestId: string;
}

/**
 * Body of `runs:toolApprovalResponse`. `answer` formats mirror the desktop's
 * dialog: chosen option labels joined with ", " or free text for a question;
 * "acceptForSession" to allow a tool for the rest of the run; a JSON object
 * string for an elicitation form.
 */
export interface ToolApprovalResponse {
  requestId: string;
  approved: boolean;
  answer?: string;
}

/** `account:get` — the phone needs the id for run mutations. */
export interface AccountResponse {
  id: string;
  displayName: string | null;
}

/** The subset of `runs:continue`'s payload the phone sends. */
export interface ContinueRunPayload {
  runId: string;
  accountId: string;
  /** The follow-up message to send. */
  message: string;
  /** Model for this continuation; omitted = the provider's default. */
  model?: string | null;
}

export interface ContinueRunResponse {
  runId: string;
  resumed: boolean;
}

/** The broker's cap on how long any request may wait (user-input-broker.ts). */
export const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

export function isTerminalRunStatus(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}
