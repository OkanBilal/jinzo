import { CHANNELS } from "@mains/contracts/channels";
import type {
  ArtifactImage,
  ContinueRunPayload,
  ForkRunPayload,
  PendingApproval,
  ReadArtifactImagePayload,
  SpaceModePayload,
  StartRunPayload,
  ToolApprovalResponse,
  UpdateRunSettingsPayload,
} from "@mains/contracts/runs";
import { WS_PROTOCOL_VERSION } from "@mains/contracts/ws-protocol";

import type { DemoHandler } from "./demo-socket";
import rawSnapshot from "./demo-snapshot.json";

/**
 * The demo Mac: everything a paired Mac answers over the wire, answered from
 * a snapshot of a real one, exported by `scripts/export-demo-snapshot.mjs`.
 * Reads serve the snapshot; a send replays a recorded run back, artifact by
 * artifact, so the reviewer watches a live run without an agent anywhere near.
 */

/** Rows travel as the wire DTOs with dates as ISO strings; `toDate` reads them. */
type Json = Record<string, unknown>;

interface DemoRun extends Json {
  id: string;
  providerId: string;
  mode: string;
  title: string | null;
  status: string;
  workspaceId: string | null;
  collectionId: string | null;
  createdAt: string;
  updatedAt: string;
}
interface DemoArtifact extends Json {
  id: number;
  runId: string;
  kind: string;
  content: string | null;
  path: string | null;
  metadata: Json | null;
  createdAt: string;
}
interface DemoSnapshot {
  backend: { backendId: string; name: string; appVersion: string };
  account: Json;
  spaces: (Json & { id: string })[];
  collections: Json[];
  projects: Json[];
  providers: (Json & { id: string; config: Json })[];
  models: Record<string, Json[]>;
  skills: Record<string, Json[]>;
  commands: Record<string, Json[]>;
  workspaces: Json[];
  gitStates: Json[];
  diffSummaries: Record<string, Json | null>;
  runs: DemoRun[];
  turns: Record<string, (Json & { id: number })[]>;
  toolCalls: Record<string, (Json & { id: number; runId: string })[]>;
  artifacts: Record<string, DemoArtifact[]>;
  images: Record<string, ArtifactImage>;
  replayRunId: string | null;
}

const snapshot = rawSnapshot as unknown as DemoSnapshot;

/** Between replayed items — slow enough to watch, fast enough for a reviewer. */
const REPLAY_STEP_MS = 900;
/** An ignored approval answers itself, so the demo never wedges. */
const APPROVAL_AUTO_RESOLVE_MS = 25_000;
const RUN_LIST_DEFAULT = 50;

const now = () => new Date().toISOString();

export class DemoBackend implements DemoHandler {
  private readonly runs: DemoRun[] = snapshot.runs.map((run) => ({ ...run }));
  private readonly artifacts = new Map<string, DemoArtifact[]>(
    Object.entries(snapshot.artifacts).map(([runId, list]) => [runId, list.map((a) => ({ ...a }))]),
  );
  private readonly toolCalls = new Map<string, (Json & { id: number; runId: string })[]>(
    Object.entries(snapshot.toolCalls).map(([runId, list]) => [runId, list.map((c) => ({ ...c }))]),
  );
  private readonly turns = new Map<string, (Json & { id: number })[]>(
    Object.entries(snapshot.turns).map(([runId, list]) => [runId, list.map((t) => ({ ...t }))]),
  );
  private readonly spaces = snapshot.spaces.map((space) => ({ ...space }));
  private readonly providers = snapshot.providers.map((provider) => ({
    ...provider,
    config: { ...provider.config },
  }));
  /** A replayed image keeps pointing at the source artifact's pixels. */
  private readonly imageAliases = new Map<number, string>();
  private approval: PendingApproval | null = null;
  private approvalContinue: (() => void) | null = null;

  private emit: ((channel: string, payload: unknown) => void) | null = null;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private nextId = 1_000_000;
  private runCounter = 0;

  attach(emit: (channel: string, payload: unknown) => void): void {
    this.emit = emit;
  }

  detach(): void {
    this.emit = null;
  }

  private push(channel: string, payload: unknown): void {
    this.emit?.(channel, payload);
  }

  private later(ms: number, fn: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }

  // ── The wire ─────────────────────────────────────────────────────────────

  invoke(channel: string, args: unknown[]): unknown {
    switch (channel) {
      case CHANNELS.backend.describe:
        return {
          backendId: snapshot.backend.backendId,
          name: snapshot.backend.name,
          appVersion: snapshot.backend.appVersion,
          protocolVersion: WS_PROTOCOL_VERSION,
          capabilities: ["runs", "workspace", "providers", "space", "projects", "collections"],
          serverTime: now(),
        };
      case CHANNELS.account.get:
        return snapshot.account;
      case CHANNELS.space.getAll:
        return this.spaces;
      case CHANNELS.collections.list:
        return snapshot.collections;
      case CHANNELS.projects.list:
        return snapshot.projects;
      case CHANNELS.providers.getEnabled:
        return this.providers;
      case CHANNELS.providers.getModels:
        return snapshot.models[String(args[0])] ?? [];
      case CHANNELS.providers.getSkills:
        return snapshot.skills[String(args[0])] ?? [];
      case CHANNELS.providers.getCommands:
        return snapshot.commands[String(args[0])] ?? [];
      case CHANNELS.providers.updateRunSettings:
        return this.updateRunSettings(String(args[0]), (args[1] ?? {}) as UpdateRunSettingsPayload);
      case CHANNELS.workspace.list:
        return snapshot.workspaces;
      case CHANNELS.workspace.listGitStates:
        return snapshot.gitStates;
      case CHANNELS.workspace.getLatestDiffSummary:
        return snapshot.diffSummaries[String(args[0])] ?? null;
      case CHANNELS.runs.getAll: {
        const limit = typeof args[0] === "number" ? args[0] : RUN_LIST_DEFAULT;
        return [...this.runs]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, limit);
      }
      case CHANNELS.runs.getById:
        return this.runs.find((run) => run.id === args[0]) ?? null;
      case CHANNELS.runs.listPendingApprovals:
        return this.approval ? [this.approval] : [];
      case CHANNELS.runTurns.getByRun:
        return this.turns.get(String(args[0])) ?? [];
      case CHANNELS.runToolCalls.getByRun:
        return this.toolCalls.get(String(args[0])) ?? [];
      case CHANNELS.runArtifacts.getByRun: {
        const list = this.artifacts.get(String(args[0])) ?? [];
        const sinceId = typeof args[1] === "number" ? args[1] : null;
        return sinceId === null ? list : list.filter((artifact) => artifact.id > sinceId);
      }
      case CHANNELS.runArtifacts.readImage: {
        const { artifactId } = args[0] as ReadArtifactImagePayload;
        const key = this.imageAliases.get(artifactId) ?? String(artifactId);
        const image = snapshot.images[key];
        if (!image) throw new Error("Image file is missing");
        return image;
      }
      case CHANNELS.runs.execute:
        return this.execute(args[0] as StartRunPayload);
      case CHANNELS.runs.continue:
        return this.continueRun(args[0] as ContinueRunPayload);
      case CHANNELS.runs.fork:
        return this.fork(args[0] as ForkRunPayload);
      case CHANNELS.runs.abort:
        return this.abort(String(args[0]));
      case CHANNELS.runs.toolApprovalResponse:
        return this.respondToApproval(args[0] as ToolApprovalResponse);
      case CHANNELS.space.update:
        return this.updateSpace(String(args[0]), (args[1] ?? {}) as Partial<SpaceModePayload>);
      default:
        throw new Error(`The demo Mac does not answer "${channel}"`);
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  private updateSpace(spaceId: string, patch: Partial<SpaceModePayload>): Json {
    const space = this.spaces.find((s) => s.id === spaceId);
    if (!space) throw new Error("Space not found");
    if (patch.mode) space.mode = patch.mode;
    return space;
  }

  /** The same key-per-provider mapping the desktop applies (`lib/models.ts` reads it back). */
  private updateRunSettings(providerId: string, patch: UpdateRunSettingsPayload): Json {
    const provider = this.providers.find((p) => p.id === providerId);
    if (!provider) throw new Error("Provider not found");
    const config = provider.config;
    const effortCoupled = providerId === "codex" || providerId === "cursor";
    if (patch.effortLevel !== undefined) {
      if (effortCoupled) config.modelReasoningEffort = patch.effortLevel;
      else if (patch.effortLevel === "ultracode") config.ultracode = true;
      else {
        config.ultracode = false;
        config.effortLevel = patch.effortLevel;
        config.thinkingMode = patch.effortLevel !== "";
      }
    }
    if (patch.permissionMode !== undefined) {
      const key = { claude_code: "permissionMode", copilot_cli: "permissionMode", codex: "sandboxMode", cursor: "mode" }[
        providerId
      ];
      if (key) config[key] = patch.permissionMode;
    }
    if (patch.fastMode !== undefined) {
      if (providerId === "codex") config.serviceTier = patch.fastMode ? "fast" : "standard";
      else config.fastMode = patch.fastMode;
    }
    if (patch.goalMode !== undefined) config.goalMode = patch.goalMode;
    if (patch.planMode !== undefined) config.planMode = patch.planMode;
    return provider;
  }

  // ── Runs: every send replays the recorded run ────────────────────────────

  private execute(payload: StartRunPayload): { runId: string } {
    this.runCounter += 1;
    const runId = `demo-run-${Date.now()}-${this.runCounter}`;
    const space = this.spaces.find((s) => s.id === payload.spaceId);
    const run: DemoRun = {
      id: runId,
      accountId: "demo-account",
      workspaceId: payload.workspaceId ?? null,
      collectionId: payload.collectionId ?? null,
      spaceId: payload.spaceId,
      providerId: payload.providerId,
      mode: (space?.mode as string | undefined) ?? "chat",
      model: payload.model ?? null,
      title: null,
      goal: payload.goal,
      status: "running",
      startedAt: now(),
      endedAt: null,
      lastError: null,
      stopReason: null,
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    this.runs.push(run);
    this.artifacts.set(runId, []);
    this.toolCalls.set(runId, []);
    this.turns.set(runId, []);
    this.startReplay(run, payload.goal);
    return { runId };
  }

  private continueRun(payload: ContinueRunPayload): { runId: string; resumed: boolean } {
    const run = this.runs.find((r) => r.id === payload.runId);
    if (!run) throw new Error("Run not found");
    run.status = "running";
    run.endedAt = null;
    run.updatedAt = now();
    this.startReplay(run, payload.message);
    return { runId: run.id, resumed: true };
  }

  private fork(payload: ForkRunPayload): { runId: string; sourceRunId: string } {
    const { runId } = this.execute({
      accountId: "demo-account",
      spaceId: String(this.spaces[0]?.id ?? ""),
      providerId: this.runs.find((r) => r.id === payload.sourceRunId)?.providerId ?? "claude_code",
      goal: payload.message,
    });
    return { runId, sourceRunId: payload.sourceRunId };
  }

  private abort(runId: string): void {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    run.status = "canceled";
    run.endedAt = now();
    run.updatedAt = now();
    this.push(CHANNELS.runs.statusChanged, { runId, status: "canceled", ts: Date.now() });
  }

  private respondToApproval(response: ToolApprovalResponse): void {
    if (!this.approval || this.approval.requestId !== response.requestId) return;
    this.approval = null;
    this.push(CHANNELS.runs.toolApprovalResolved, { requestId: response.requestId });
    const resume = this.approvalContinue;
    this.approvalContinue = null;
    resume?.();
  }

  /**
   * Replay the recorded run onto `run`: the reviewer's own prompt first, then
   * the source's closing turn one artifact at a time, one approval in the
   * middle, and a settled status at the end. Every step is a real
   * `eventPersisted` push, so the phone pulls it exactly as it would live.
   */
  private startReplay(run: DemoRun, prompt: string): void {
    const source = snapshot.replayRunId ? (snapshot.artifacts[snapshot.replayRunId] ?? []) : [];
    // The closing turn: everything after the source's last user prompt.
    let start = 0;
    for (let i = source.length - 1; i >= 0; i--) {
      if (source[i].kind === "user-prompt") {
        start = i + 1;
        break;
      }
    }
    const items = source.slice(start, start + 24);
    const sourceCalls = snapshot.replayRunId ? (snapshot.toolCalls[snapshot.replayRunId] ?? []) : [];
    // A tool call belongs to the artifact it ran before — the transcript
    // interleaves the two by time. Bucket each call into the first item
    // recorded at or after it, so a replayed turn shows its work rather than
    // bare prose. (Matching timestamps exactly never held: the two tables are
    // written by different code paths, milliseconds apart.)
    const at = (value: unknown) => Date.parse(String(value ?? "")) || 0;
    const turnStart = start > 0 ? at(source[start - 1].createdAt) : 0;
    const callsByItem = new Map<number, (Json & { id: number; runId: string })[]>();
    for (const call of sourceCalls) {
      const when = at(call.createdAt);
      if (when < turnStart) continue;
      let index = items.findIndex((item) => at(item.createdAt) >= when);
      if (index < 0) index = items.length - 1;
      if (index < 0) continue;
      const bucket = callsByItem.get(index);
      if (bucket) bucket.push(call);
      else callsByItem.set(index, [call]);
    }

    this.push(CHANNELS.runs.statusChanged, { runId: run.id, status: "running", ts: Date.now() });

    const list = this.artifacts.get(run.id) ?? [];
    this.artifacts.set(run.id, list);
    const calls = this.toolCalls.get(run.id) ?? [];
    this.toolCalls.set(run.id, calls);

    // The prompt echoes back at once, as the Mac's own copy.
    list.push({
      id: this.nextId++,
      runId: run.id,
      kind: "user-prompt",
      content: prompt,
      path: null,
      metadata: { source: "user" },
      createdAt: now(),
    });
    this.push(CHANNELS.runs.eventPersisted, { runId: run.id, ts: Date.now() });

    const approvalAfter = Math.min(2, Math.max(items.length - 1, 0));
    const step = (index: number) => {
      if (run.status !== "running") return;
      if (index >= items.length) {
        run.status = "succeeded";
        run.endedAt = now();
        run.updatedAt = now();
        if (!run.title) {
          run.title = (this.runs.find((r) => r.id === snapshot.replayRunId)?.title ?? "Demo run") as string;
          this.push(CHANNELS.runs.updated, { runId: run.id, ts: Date.now() });
        }
        this.push(CHANNELS.runs.statusChanged, { runId: run.id, status: "succeeded", ts: Date.now() });
        return;
      }
      const item = items[index];
      const id = this.nextId++;
      list.push({ ...item, id, runId: run.id, createdAt: now() });
      if (item.kind === "image") this.imageAliases.set(id, String(item.id));
      for (const call of callsByItem.get(index) ?? []) {
        calls.push({ ...call, id: this.nextId++, runId: run.id, createdAt: now(), updatedAt: now() });
      }
      run.updatedAt = now();
      this.push(CHANNELS.runs.eventPersisted, { runId: run.id, ts: Date.now() });

      if (index === approvalAfter && items.length > 2) {
        this.askApproval(run, () => this.later(REPLAY_STEP_MS, () => step(index + 1)));
        return;
      }
      this.later(REPLAY_STEP_MS, () => step(index + 1));
    };
    this.later(REPLAY_STEP_MS, () => step(0));
  }

  /** One approval per replay: real card, real countdown, answers itself if ignored. */
  private askApproval(run: DemoRun, resume: () => void): void {
    const requestId = `demo-approval-${Date.now()}`;
    this.approval = {
      requestId,
      runId: run.id,
      toolName: "Bash",
      toolInput: { command: "npm run build" },
      kind: "tool_approval",
      header: "Run a command?",
      question: "The agent wants to run `npm run build` in the workspace.",
      timestamp: Date.now(),
      expiresAt: Date.now() + APPROVAL_AUTO_RESOLVE_MS,
    };
    this.approvalContinue = resume;
    this.push(CHANNELS.runs.toolApprovalRequest, this.approval);
    this.later(APPROVAL_AUTO_RESOLVE_MS, () => {
      if (this.approval?.requestId !== requestId) return;
      this.respondToApproval({ requestId, approved: true });
    });
  }
}
