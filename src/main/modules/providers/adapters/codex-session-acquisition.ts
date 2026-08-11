import type {
  AcquiredSession,
  CodexAdapterConfig,
  FileAttachment,
  WorkRunContextItem,
  WorkRunContinueRequest,
  WorkRunEvent,
  WorkRunForkRequest,
  WorkRunRequest,
  WorkRunReviewRequest,
} from "../../../../shared/adapter.types";
import {
  appendPromptSections,
  createLogger,
  formatContextSection,
  saveAttachments,
  type AdapterLogger,
} from "./adapter.shared";
import type { CodexAppServer } from "./codex-app-server.client";
import type { CodexAppServerParams } from "./codex-app-server-protocol/rpc";
import type { MainsToolContext } from "./mains-tools.core";
import { toCodexDynamicTools } from "./mains-tools.registry";
import type {
  CodexRunCoordinator,
  CodexRunSession,
} from "./codex-run-coordinator";
import type { CodexSubAgentRunMeta } from "./codex-event-mapper";

export const CODEX_ARCHIVED_CHAT_MESSAGE =
  "This chat is archived in Codex. Unarchive it in Codex to continue, or archive it in Mains to hide it from this workspace.";

const VALID_SANDBOX_MODES = new Set([
  "read-only",
  "workspace-write",
  "danger-full-access",
]);
const MAINS_DYNAMIC_TOOLS = toCodexDynamicTools();

type CodexConfigOverrides = NonNullable<
  CodexAppServerParams<"thread/start">["config"]
>;
type CodexOutputSchema = Exclude<
  CodexAppServerParams<"turn/start">["outputSchema"],
  null | undefined
>;
type CodexThreadStartParams =
  CodexAppServerParams<"thread/start"> & {
    dynamicTools?: typeof MAINS_DYNAMIC_TOOLS;
  };
type CodexTurnStartParams =
  CodexAppServerParams<"turn/start"> & {
    collaborationMode?: Record<string, unknown>;
  };
type TurnInput = CodexAppServerParams<"turn/start">["input"];

interface TurnInputRequest {
  runId: string;
  context?: WorkRunContextItem[];
  contextIssues?: WorkRunRequest["contextIssues"];
  contextSignals?: WorkRunRequest["contextSignals"];
  contextFiles?: WorkRunRequest["contextFiles"];
  skills?: WorkRunRequest["skills"];
  attachments?: FileAttachment[];
}

interface CodexSessionAcquisitionOptions {
  config: CodexAdapterConfig;
  ensureServer: (cwd?: string) => Promise<CodexAppServer>;
  runCoordinator: CodexRunCoordinator;
  findPersistedSession: (
    runId: string,
  ) => Promise<string | undefined>;
  findPersistedSubAgents?: (
    runId: string,
  ) => Promise<CodexSubAgentRunMeta[]>;
  persistSession: (
    runId: string,
    threadId: string,
  ) => Promise<void>;
  establishGoal: (
    server: CodexAppServer,
    threadId: string | undefined,
    goalMode: boolean,
    objective: string | undefined,
    rootPath: string | undefined,
    overwrite: boolean,
  ) => Promise<void>;
  logger?: AdapterLogger;
}

function codexErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isCodexArchivedThreadError(
  error: unknown,
): boolean {
  return /\b(?:session|thread)\b[^\n]*\bis archived\b/i.test(
    codexErrorMessage(error),
  );
}

function isCodexMissingThreadError(error: unknown): boolean {
  return (
    /\b(?:session|thread)\b[^\n]*\bnot found\b/i.test(
      codexErrorMessage(error),
    ) ||
    /\b(?:missing|unknown) thread\b|\b(?:session|thread)\b[^\n]*\bdoes not exist\b/i.test(
      codexErrorMessage(error),
    )
  );
}

export function isCodexUnavailableThreadError(
  error: unknown,
): boolean {
  return (
    isCodexArchivedThreadError(error) ||
    isCodexMissingThreadError(error)
  );
}

export function normalizeCodexResumeError(
  error: unknown,
): Error {
  if (isCodexArchivedThreadError(error)) {
    return new Error(CODEX_ARCHIVED_CHAT_MESSAGE);
  }
  return error instanceof Error
    ? error
    : new Error(String(error));
}

export function mapSandboxMode(
  mode?: string,
): "read-only" | "workspace-write" | "danger-full-access" {
  return mode && VALID_SANDBOX_MODES.has(mode)
    ? mode as
        | "read-only"
        | "workspace-write"
        | "danger-full-access"
    : "workspace-write";
}

function resolveOutputSchema(
  config: CodexAdapterConfig,
): CodexOutputSchema | undefined {
  const selectedId = config.structuredOutputsSelectedId;
  if (!selectedId) return undefined;
  return config.structuredOutputs?.[selectedId]?.schema as
    | CodexOutputSchema
    | undefined;
}

function buildCodexConfigOverrides(
  networkAccess: boolean,
): CodexConfigOverrides {
  return {
    sandbox_workspace_write: {
      network_access: networkAccess,
    },
  };
}

export function buildCollaborationMode(
  planEnabled: boolean,
  model: string | undefined,
  effort: string | undefined,
  forceReset = false,
): Record<string, unknown> | undefined {
  if (!planEnabled && !forceReset) return undefined;
  return {
    mode: planEnabled ? "plan" : "default",
    settings: {
      model: model ?? "",
      reasoning_effort:
        effort ?? (planEnabled ? "medium" : null),
      developer_instructions: null,
    },
  };
}

export function buildCodexReviewTarget(
  target: WorkRunReviewRequest["target"],
): CodexAppServerParams<"review/start">["target"] {
  if (target.type === "uncommittedChanges") {
    return { type: "uncommittedChanges" };
  }
  if (target.type === "baseBranch") {
    if (!target.branch) {
      throw new Error(
        "A base branch is required for a base-branch review",
      );
    }
    return { type: "baseBranch", branch: target.branch };
  }
  if (target.type === "commit") {
    if (!target.sha) {
      throw new Error(
        "A commit SHA is required for a commit review",
      );
    }
    return {
      type: "commit",
      sha: target.sha,
      title: target.title ?? null,
    };
  }
  if (!target.instructions) {
    throw new Error(
      "Instructions are required for a custom review",
    );
  }
  return {
    type: "custom",
    instructions: target.instructions,
  };
}

function buildTurnInput(
  message: string,
  request: TurnInputRequest,
  interruptedSubAgents: CodexSubAgentRunMeta[] = [],
): TurnInput {
  let prompt =
    request.context && request.context.length > 0
      ? `Context:\n${formatContextSection(request.context)}\n\n---\n\n ${message}`
      : message;

  prompt = appendPromptSections(prompt, {
    contextIssues: request.contextIssues,
    contextSignals: request.contextSignals,
    contextFiles: request.contextFiles,
    runId: request.runId,
  });

  if (interruptedSubAgents.length > 0) {
    const agents = interruptedSubAgents.map((agent) => ({
      id: agent.threadId,
      ...(agent.nickname ? { name: agent.nickname } : {}),
      ...(agent.role ? { role: agent.role } : {}),
    }));
    prompt +=
      "\n\n<mains_interrupted_subagents>\n" +
      "The previous turn was stopped, so these subagents are interrupted and are not making progress:\n" +
      `${JSON.stringify(agents)}\n` +
      "If the user's current request still depends on their work, do not call wait_agent on them yet. " +
      "First call resume_agent for each interrupted id, then call send_input asking it to continue its previously assigned task. " +
      "If an agent cannot be resumed, spawn a replacement for that task. " +
      "If the current request no longer depends on them, continue without waiting for them.\n" +
      "</mains_interrupted_subagents>";
  }

  const input: TurnInput = [{
    type: "text",
    text: prompt,
    text_elements: [],
  }];

  for (const skill of request.skills ?? []) {
    if (skill.name && skill.path) {
      input.push({
        type: "skill",
        name: skill.name,
        path: skill.path,
      });
    }
  }

  if (request.attachments && request.attachments.length > 0) {
    const { savedPaths, inlineTexts } = saveAttachments(
      request.attachments,
      request.runId,
    );
    if (inlineTexts.length > 0 && input[0].type === "text") {
      input[0].text =
        `${prompt}\n\n---\n\nAttached documents:\n` +
        inlineTexts.join("\n\n");
    }

    for (const attachmentPath of savedPaths) {
      const lowerPath = attachmentPath.toLowerCase();
      if (
        lowerPath.endsWith(".png") ||
        lowerPath.endsWith(".jpg") ||
        lowerPath.endsWith(".jpeg") ||
        lowerPath.endsWith(".gif") ||
        lowerPath.endsWith(".webp") ||
        lowerPath.endsWith(".bmp")
      ) {
        input.push({
          type: "localImage",
          path: attachmentPath,
        });
      }
    }
  }

  return input;
}

function mainsContext(
  runId: string,
  workspace: { id: string; rootPath: string },
): MainsToolContext {
  return {
    workspaceId: workspace.id,
    rootPath: workspace.rootPath,
    runId,
  };
}

function reviewPromptEvent(
  request: WorkRunReviewRequest,
): WorkRunEvent {
  const targetLabel =
    request.target.type === "uncommittedChanges"
      ? "Review uncommitted changes"
      : request.target.type === "baseBranch"
        ? `Changes vs ${request.target.branch ?? "base branch"}`
        : request.target.type === "commit"
          ? `Commit ${request.target.sha?.substring(0, 7) ?? ""}${request.target.title ? ` — ${request.target.title}` : ""}`
          : "Code Changes";
  return {
    type: "artifact",
    kind: "user-prompt",
    content: targetLabel,
    metadata: {
      source: "user",
      isReview: true,
      reviewTarget: request.target.type,
      delivery: request.delivery ?? "inline",
    },
  };
}

/**
 * Owns Codex thread/session acquisition and produces prepared sessions whose
 * turns are executed by the Codex run coordinator.
 */
export function createCodexSessionAcquisition(
  options: CodexSessionAcquisitionOptions,
) {
  const {
    config,
    ensureServer,
    runCoordinator,
    findPersistedSession,
    findPersistedSubAgents,
    persistSession,
    establishGoal,
  } = options;
  const logger =
    options.logger ?? createLogger("[CodexSessionAcquisition]");
  // Read through `config` on every use, never snapshot: the driver refreshes
  // this same object in place when provider settings change
  // (`ProviderDriver.updateConfig`).
  const timeout = () => config.timeout ?? 3_600_000;

  function effectiveModel(
    requestedModel: string | null | undefined,
  ): string | undefined {
    return requestedModel || config.defaultModel || undefined;
  }

  function commonThreadSettings() {
    return {
      approvalPolicy: config.approvalMode ?? "on-request",
      sandbox: mapSandboxMode(config.sandboxMode),
      personality: config.personality ?? "none",
      config: buildCodexConfigOverrides(
        config.networkAccessEnabled !== false,
      ),
    };
  }

  function makeSession(
    runId: string,
    model: string | undefined,
    startTurn: () => Promise<void>,
    preExecuteEvent?: WorkRunEvent,
  ): CodexRunSession {
    return {
      runId,
      startTurn,
      model,
      timeout: timeout(),
      ...(preExecuteEvent ? { preExecuteEvent } : {}),
    };
  }

  async function createSession(
    request: WorkRunRequest,
  ): Promise<AcquiredSession> {
    const { runId } = request;
    const model = effectiveModel(request.model);
    const server = await ensureServer();
    const overrides = (
      request.configSnapshot ?? {}
    ) as Record<string, unknown>;
    const overrideSandboxMode =
      typeof overrides.sandboxMode === "string"
        ? overrides.sandboxMode as CodexAdapterConfig["sandboxMode"]
        : undefined;
    const overrideEffort =
      typeof overrides.modelReasoningEffort === "string"
        ? overrides.modelReasoningEffort
        : typeof overrides.effortLevel === "string" &&
            overrides.effortLevel
          ? overrides.effortLevel
          : undefined;
    const overrideServiceTier =
      typeof overrides.serviceTier === "string" &&
      overrides.serviceTier
        ? overrides.serviceTier
        : undefined;
    const overridePlanMode =
      typeof overrides.planMode === "boolean"
        ? overrides.planMode
        : undefined;
    const overrideGoalMode =
      typeof overrides.goalMode === "boolean"
        ? overrides.goalMode
        : undefined;
    const settings = commonThreadSettings();
    const threadStartParams: CodexThreadStartParams = {
      cwd: request.workspace.rootPath,
      ...settings,
      sandbox: mapSandboxMode(
        overrideSandboxMode ?? config.sandboxMode,
      ),
      ...(model ? { model } : {}),
      dynamicTools: MAINS_DYNAMIC_TOOLS,
    };

    logger.info(
      `Starting thread (model: ${model || "default"}, cwd: ${request.workspace.rootPath})`,
    );
    const threadResult = await server.sendRequest(
      "thread/start",
      threadStartParams,
    );
    const threadId = threadResult.thread.id;
    if (threadId) {
      runCoordinator.attachThread(runId, threadId);
    }

    await establishGoal(
      server,
      threadId,
      overrideGoalMode ?? config.goalMode ?? false,
      request.goal,
      request.workspace.rootPath,
      true,
    );
    runCoordinator.registerRun({
      runId,
      threadId: threadId ?? null,
      mainsCtx: mainsContext(runId, request.workspace),
    });

    const effort =
      overrideEffort ?? config.modelReasoningEffort;
    const serviceTier =
      overrideServiceTier ?? config.serviceTier;
    const collaborationMode = buildCollaborationMode(
      overridePlanMode ?? config.planMode ?? false,
      model,
      effort,
    );
    const outputSchema = resolveOutputSchema(config);
    const turnStartParams: CodexTurnStartParams = {
      threadId: threadId ?? "",
      input: buildTurnInput(request.goal, request),
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      ...(serviceTier ? { serviceTier } : {}),
      ...(outputSchema ? { outputSchema } : {}),
      ...(collaborationMode ? { collaborationMode } : {}),
    };
    const startTurn = async () => {
      await server.sendRequest("turn/start", turnStartParams);
    };
    return {
      session: makeSession(runId, model, startTurn),
      prompt: request.goal,
      sessionId: threadId,
    };
  }

  async function resumeSession(
    request: WorkRunContinueRequest,
  ): Promise<AcquiredSession> {
    const { runId, message } = request;
    const model = effectiveModel(request.model);
    const server = await ensureServer();
    let threadId =
      runCoordinator.getSessionThread(runId) ??
      await findPersistedSession(runId);
    if (threadId) {
      runCoordinator.attachThread(runId, threadId);
    }
    if (!threadId) {
      throw new Error(
        `No session found for run ${runId}. Cannot resume.`,
      );
    }

    const settings = commonThreadSettings();
    try {
      await server.sendRequest("thread/resume", {
        threadId,
        cwd: request.workspace.rootPath,
        ...settings,
        ...(model ? { model } : {}),
      });
    } catch (resumeError) {
      if (isCodexArchivedThreadError(resumeError)) {
        throw normalizeCodexResumeError(resumeError);
      }
      if (!isCodexMissingThreadError(resumeError)) {
        throw resumeError;
      }
      logger.warn(
        `Thread resume failed (${codexErrorMessage(resumeError)}), starting new thread`,
      );
      const threadStartParams: CodexThreadStartParams = {
        cwd: request.workspace.rootPath,
        ...settings,
        ...(model ? { model } : {}),
        dynamicTools: MAINS_DYNAMIC_TOOLS,
      };
      const threadResult = await server.sendRequest(
        "thread/start",
        threadStartParams,
      );
      threadId = threadResult.thread.id;
      runCoordinator.attachThread(runId, threadId);
    }

    const persistedSubAgents =
      !runCoordinator.hasSessionSubAgentState(runId) && findPersistedSubAgents
        ? await findPersistedSubAgents(runId)
        : [];
    runCoordinator.registerRun({
      runId,
      threadId,
      mainsCtx: mainsContext(runId, request.workspace),
      subAgents: persistedSubAgents,
    });
    const interruptedSubAgents =
      runCoordinator.getInterruptedSubAgents(runId);
    const currentThreadId =
      runCoordinator.getSessionThread(runId) ?? threadId;
    await establishGoal(
      server,
      currentThreadId,
      config.goalMode ?? false,
      message,
      request.workspace.rootPath,
      false,
    );

    const collaborationMode = buildCollaborationMode(
      config.planMode ?? false,
      model,
      config.modelReasoningEffort,
      true,
    );
    const outputSchema = resolveOutputSchema(config);
    const turnStartParams: CodexTurnStartParams = {
      threadId: currentThreadId,
      input: buildTurnInput(
        message,
        request,
        interruptedSubAgents,
      ),
      ...(model ? { model } : {}),
      ...(config.modelReasoningEffort
        ? { effort: config.modelReasoningEffort }
        : {}),
      ...(config.serviceTier
        ? { serviceTier: config.serviceTier }
        : {}),
      ...(outputSchema ? { outputSchema } : {}),
      ...(collaborationMode ? { collaborationMode } : {}),
    };
    const startTurn = async () => {
      await server.sendRequest("turn/start", turnStartParams);
    };
    return {
      session: makeSession(runId, model, startTurn),
      prompt: message,
      sessionId: threadId,
    };
  }

  async function forkSession(
    request: WorkRunForkRequest,
  ): Promise<AcquiredSession> {
    const { runId, sourceRunId, message } = request;
    const model = effectiveModel(request.model);
    logger.info(
      `Forking session from run ${sourceRunId} into new run ${runId}`,
    );
    const server = await ensureServer();
    const sourceThreadId =
      runCoordinator.getSessionThread(sourceRunId) ??
      await findPersistedSession(sourceRunId);
    if (!sourceThreadId) {
      throw new Error(
        `No session found for source run ${sourceRunId}. Cannot fork.`,
      );
    }
    runCoordinator.attachThread(sourceRunId, sourceThreadId);

    const settings = commonThreadSettings();
    const forkResult = await server.sendRequest("thread/fork", {
      threadId: sourceThreadId,
      cwd: request.workspace.rootPath,
      approvalPolicy: settings.approvalPolicy,
      sandbox: settings.sandbox,
      ...(model ? { model } : {}),
      config: settings.config,
    });
    const forkedThreadId = forkResult.thread.id;
    runCoordinator.attachThread(runId, forkedThreadId);
    await establishGoal(
      server,
      forkedThreadId,
      config.goalMode ?? false,
      message,
      request.workspace.rootPath,
      false,
    );
    runCoordinator.registerRun({
      runId,
      threadId: forkedThreadId,
      mainsCtx: mainsContext(runId, request.workspace),
    });

    const collaborationMode = buildCollaborationMode(
      config.planMode ?? false,
      model,
      config.modelReasoningEffort,
      true,
    );
    const outputSchema = resolveOutputSchema(config);
    const turnStartParams: CodexTurnStartParams = {
      threadId: forkedThreadId,
      input: buildTurnInput(message, request),
      ...(model ? { model } : {}),
      ...(config.modelReasoningEffort
        ? { effort: config.modelReasoningEffort }
        : {}),
      ...(config.serviceTier
        ? { serviceTier: config.serviceTier }
        : {}),
      ...(outputSchema ? { outputSchema } : {}),
      ...(collaborationMode ? { collaborationMode } : {}),
    };
    const startTurn = async () => {
      await server.sendRequest("turn/start", turnStartParams);
    };
    return {
      session: makeSession(runId, model, startTurn),
      prompt: message,
      sessionId: forkedThreadId,
    };
  }

  async function reviewSession(
    request: WorkRunReviewRequest,
  ): Promise<AcquiredSession> {
    const { runId } = request;
    const target = buildCodexReviewTarget(request.target);
    const model = effectiveModel(request.model);
    const server = await ensureServer();
    const settings = commonThreadSettings();
    const threadStartParams: CodexThreadStartParams = {
      cwd: request.workspace.rootPath,
      ...settings,
      ...(model ? { model } : {}),
      dynamicTools: MAINS_DYNAMIC_TOOLS,
    };

    logger.info(
      `Starting review thread (model: ${model || "default"}, cwd: ${request.workspace.rootPath})`,
    );
    const threadResult = await server.sendRequest(
      "thread/start",
      threadStartParams,
    );
    const threadId = threadResult.thread.id;
    runCoordinator.registerRun({
      runId,
      threadId: threadId ?? null,
      mainsCtx: mainsContext(runId, request.workspace),
    });

    const reviewStartParams:
      CodexAppServerParams<"review/start"> = {
        threadId,
        target,
        ...(request.delivery
          ? { delivery: request.delivery }
          : {}),
      };
    const startTurn = async () => {
      logger.info(
        `Starting review: target=${request.target.type}, delivery=${request.delivery ?? "inline"}`,
      );
      const result = await server.sendRequest(
        "review/start",
        reviewStartParams,
      );
      const reviewThreadId = result.reviewThreadId;
      runCoordinator.attachThread(
        runId,
        reviewThreadId,
        result.turn.id,
      );
      if (reviewThreadId !== threadId) {
        void persistSession(runId, reviewThreadId).catch(
          (error) =>
            logger.warn(
              "Failed to persist detached review thread:",
              error instanceof Error
                ? error.message
                : error,
            ),
        );
      }
    };

    return {
      session: makeSession(
        runId,
        model,
        startTurn,
        reviewPromptEvent(request),
      ),
      prompt: "",
      sessionId: threadId,
    };
  }

  return {
    createSession,
    forkSession,
    resumeSession,
    reviewSession,
  };
}

export type CodexSessionAcquisition = ReturnType<
  typeof createCodexSessionAcquisition
>;
