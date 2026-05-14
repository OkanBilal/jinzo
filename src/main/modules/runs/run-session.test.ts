import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createProvider,
  createWorkspace,
  createRun,
  createRunTurn,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

// Initial-turn insertion + sleep-blocker + baseRef capture are fire-and-forget
// in the session constructor. Tests await this flush before asserting initial
// state or projecting events that depend on it.
const flushBackground = () => new Promise((r) => setTimeout(r, 50));

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

vi.mock("electron", () => ({
  powerSaveBlocker: {
    start: vi.fn(() => 1),
    stop: vi.fn(),
    isStarted: vi.fn(() => true),
  },
  Notification: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    show: vi.fn(),
  })),
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  app: {
    isReady: () => true,
    whenReady: () => Promise.resolve(),
    getPath: (name: string) => `/tmp/mains-test/${name}`,
    isPackaged: false,
  },
}));

vi.mock("../providers/adapters", () => ({
  createWorkAdapter: vi.fn(),
  couldModifyFiles: vi.fn().mockReturnValue(false),
}));

vi.mock("../git/git.service", () => ({
  gitService: {
    getHeadSha: vi.fn(),
    getDiffSince: vi.fn(),
    getChangedFilesSince: vi.fn(),
    getShortStatSince: vi.fn(),
    getUntrackedFiles: vi.fn(),
  },
}));

vi.mock("../workspaceDiffs/workspaceDiffs.service", () => ({
  workspaceDiffsService: {
    createDiff: vi.fn().mockResolvedValue({ success: true, data: "diff-id" }),
  },
}));

vi.mock("../workspaceDiffs/workspaceDiffs.repo", () => ({
  workspaceDiffsRepo: {
    findByWorkspace: vi.fn().mockResolvedValue([]),
    findByRun: vi.fn().mockResolvedValue(null),
    updateDiff: vi.fn(),
    deleteLatestByWorkspace: vi.fn(),
  },
}));

vi.mock("../workspaceActivity/workspaceActivity.service", () => ({
  workspaceActivityService: {
    log: vi.fn(),
  },
}));

import { createRunSession } from "./run-session";
import { runSessionRegistry } from "./run-session-registry";
import { runsRepo } from "./runs.repo";
import { createWorkAdapter, couldModifyFiles } from "../providers/adapters";
import { gitService } from "../git/git.service";

describe("RunSession", () => {
  beforeEach(() => {
    const setup = createTestDb();
    db = setup.db;
    _sqlite = setup.sqlite;
    cleanup = setup.cleanup;

    createAccount(db, { id: "default" });
    createProvider(db, { id: "copilot_cli" });
    createWorkspace(db, { id: "w1", rootPath: "/tmp/w1" });
    createRun(db, {
      id: "r1",
      accountId: "default",
      providerId: "copilot_cli",
      workspaceId: "w1",
      status: "running",
    });

    // Default: not a git repo — captureBaseRef returns null
    vi.mocked(gitService.getHeadSha).mockResolvedValue({
      success: false,
      error: "not a git repo",
    });
    vi.mocked(createWorkAdapter).mockReset();
    vi.mocked(couldModifyFiles).mockReturnValue(false);
  });

  afterEach(() => {
    // Drain any sessions left in the registry (idempotent finalize won't be
    // called from the test, so unregister directly).
    for (const session of [...runSessionRegistry.active()]) {
      runSessionRegistry.unregister(session.runId);
    }
    cleanup?.();
    vi.clearAllMocks();
  });

  function makeSession(
    overrides: Partial<Parameters<typeof createRunSession>[0]> = {},
  ) {
    return createRunSession({
      runId: "r1",
      accountId: "default",
      providerId: "copilot_cli",
      workspace: { id: "w1", rootPath: "/tmp/w1" },
      initialPromptContent: "do the thing",
      ...overrides,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Construction
  // ─────────────────────────────────────────────────────────────
  describe("construction", () => {
    it("registers itself in the registry", () => {
      const session = makeSession();
      expect(runSessionRegistry.get("r1")).toBe(session);
    });

    it("creates an initial turn at index 0 for fresh runs", async () => {
      makeSession();
      await flushBackground();
      const turns = await runsRepo.findTurnsByRun("r1");
      expect(turns).toHaveLength(1);
      expect(turns[0].turnIndex).toBe(0);
    });

    it("creates a turn at seedTurnIndex + 1 for continued runs", async () => {
      createRunTurn(db, { runId: "r1", turnIndex: 0 });
      createRunTurn(db, { runId: "r1", turnIndex: 1 });
      createRunTurn(db, { runId: "r1", turnIndex: 2 });

      makeSession({ seedTurnIndex: 2, initialPromptContent: "continued message" });
      await flushBackground();

      const turns = await runsRepo.findTurnsByRun("r1");
      const indexes = turns.map((t) => t.turnIndex).sort();
      expect(indexes).toEqual([0, 1, 2, 3]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // project — log events
  // ─────────────────────────────────────────────────────────────
  describe("project — log events", () => {
    it("inserts a log artifact", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "log",
        message: "Starting work...",
        level: "info",
        ts: Date.now(),
      } as any);

      const artifacts = await runsRepo.findArtifactsByRun("r1");
      const log = artifacts.find((a) => a.kind === "log");
      expect(log).toBeTruthy();
      expect(log!.content).toBe("Starting work...");
    });

    it("updates run title when threadTitle is in metadata", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "log",
        message: "thread name update",
        level: "info",
        ts: Date.now(),
        metadata: { threadTitle: "My Codex Thread" },
      } as any);

      const run = await runsRepo.findRunById("r1");
      expect(run!.title).toBe("My Codex Thread");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // project — tool_call events
  // ─────────────────────────────────────────────────────────────
  describe("project — tool_call events", () => {
    it("inserts a running tool_call on start", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Bash",
        input: { command: "ls" },
        metadata: { phase: "start", toolCallId: "tc-1" },
      } as any);

      const calls = await runsRepo.findToolCallsByRun("r1");
      expect(calls).toHaveLength(1);
      expect(calls[0].toolName).toBe("Bash");
      expect(calls[0].status).toBe("running");
    });

    it("updates tool_call to done on end after start", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Bash",
        input: { command: "ls" },
        metadata: { phase: "start", toolCallId: "tc-1" },
      } as any);

      await session.project({
        type: "tool_call",
        toolName: "Bash",
        output: { stdout: "file.ts" },
        metadata: { phase: "end", toolCallId: "tc-1" },
        startedAt: 1000,
        endedAt: 2500,
      } as any);

      const calls = await runsRepo.findToolCallsByRun("r1");
      expect(calls).toHaveLength(1);
      expect(calls[0].status).toBe("done");
      expect(calls[0].latencyMs).toBe(1500);
    });

    it("updates tool_call to error when end carries an error", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Read",
        metadata: { phase: "start", toolCallId: "tc-2" },
      } as any);

      await session.project({
        type: "tool_call",
        toolName: "Read",
        error: "file not found",
        metadata: { phase: "end", toolCallId: "tc-2" },
      } as any);

      const calls = await runsRepo.findToolCallsByRun("r1");
      expect(calls[0].status).toBe("error");
    });

    it("treats complete phase the same as end", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Edit",
        metadata: { phase: "start", toolCallId: "tc-3" },
      } as any);

      await session.project({
        type: "tool_call",
        toolName: "Edit",
        output: { ok: true },
        metadata: { phase: "complete", toolCallId: "tc-3" },
      } as any);

      const calls = await runsRepo.findToolCallsByRun("r1");
      expect(calls[0].status).toBe("done");
    });

    it("silently drops tool_call/end with no matching start", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Bash",
        metadata: { phase: "end", toolCallId: "unknown" },
      } as any);

      const calls = await runsRepo.findToolCallsByRun("r1");
      expect(calls).toHaveLength(0);
    });

    it("matches end to start by toolName fallback when toolCallId is missing", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Grep",
        metadata: { phase: "start" },
        startedAt: 1000,
      } as any);

      await session.project({
        type: "tool_call",
        toolName: "Grep",
        output: { lines: ["match"] },
        metadata: { phase: "end" },
        startedAt: 1000,
        endedAt: 1500,
      } as any);

      const calls = await runsRepo.findToolCallsByRun("r1");
      expect(calls).toHaveLength(1);
      expect(calls[0].status).toBe("done");
    });

    it("schedules a live diff when end is for a file-modifying tool", async () => {
      vi.mocked(couldModifyFiles).mockReturnValue(true);
      vi.mocked(gitService.getHeadSha).mockResolvedValue({
        success: true,
        data: "sha1",
      });
      vi.mocked(gitService.getDiffSince).mockResolvedValue({ success: true, data: "" });
      vi.mocked(gitService.getChangedFilesSince).mockResolvedValue({ success: true, data: [] });
      vi.mocked(gitService.getShortStatSince).mockResolvedValue({ success: true, data: "" });
      vi.mocked(gitService.getUntrackedFiles).mockResolvedValue({ success: true, data: [] });

      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Edit",
        metadata: { phase: "start", toolCallId: "tc-mod" },
      } as any);

      await session.project({
        type: "tool_call",
        toolName: "Edit",
        metadata: { phase: "end", toolCallId: "tc-mod" },
      } as any);

      // Live diff is debounced (300ms). Wait past the debounce.
      await new Promise((r) => setTimeout(r, 400));

      expect(vi.mocked(gitService.getDiffSince)).toHaveBeenCalled();
    });

    it("does not schedule a live diff when end has an error", async () => {
      vi.mocked(couldModifyFiles).mockReturnValue(true);
      vi.mocked(gitService.getHeadSha).mockResolvedValue({ success: true, data: "sha1" });

      const session = makeSession();
      await flushBackground();
      vi.mocked(gitService.getDiffSince).mockClear();

      await session.project({
        type: "tool_call",
        toolName: "Edit",
        metadata: { phase: "start", toolCallId: "tc-err" },
      } as any);

      await session.project({
        type: "tool_call",
        toolName: "Edit",
        error: "broke",
        metadata: { phase: "end", toolCallId: "tc-err" },
      } as any);

      await new Promise((r) => setTimeout(r, 400));
      expect(vi.mocked(gitService.getDiffSince)).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // project — artifact events
  // ─────────────────────────────────────────────────────────────
  describe("project — artifact events", () => {
    it("inserts an artifact for non-ephemeral events", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "artifact",
        kind: "file",
        path: "/src/index.ts",
        content: "export {}",
        metadata: {},
      } as any);

      const artifacts = await runsRepo.findArtifactsByRun("r1");
      const file = artifacts.find((a) => a.kind === "file");
      expect(file).toBeTruthy();
      expect(file!.path).toBe("/src/index.ts");
    });

    it("does not insert an artifact for ephemeral events", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "artifact",
        kind: "file",
        path: "/stream",
        content: "chunk",
        ephemeral: true,
        metadata: {},
      } as any);

      const artifacts = await runsRepo.findArtifactsByRun("r1");
      expect(artifacts.filter((a) => a.kind === "file")).toHaveLength(0);
    });

    it("starts a new turn on user-prompt artifact", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "artifact",
        kind: "result",
        content: "follow-up question",
        metadata: { kind: "user-prompt" },
      } as any);

      const turns = await runsRepo.findTurnsByRun("r1");
      const indexes = turns.map((t) => t.turnIndex).sort();
      expect(indexes).toEqual([0, 1]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // project — other events
  // ─────────────────────────────────────────────────────────────
  describe("project — other events", () => {
    it("inserts a prompt_suggestion artifact", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "prompt_suggestion",
        suggestion: "Try asking about X",
        ts: Date.now(),
      } as any);

      const artifacts = await runsRepo.findArtifactsByRun("r1");
      const ps = artifacts.find((a) => a.kind === "prompt_suggestion");
      expect(ps).toBeTruthy();
      expect(ps!.content).toBe("Try asking about X");
    });

    it("treats status event as a no-op (no DB write)", async () => {
      const session = makeSession();
      await flushBackground();
      const before = await runsRepo.findArtifactsByRun("r1");

      await session.project({
        type: "status",
        status: "running",
      } as any);

      const after = await runsRepo.findArtifactsByRun("r1");
      expect(after).toHaveLength(before.length);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // project — after finalize
  // ─────────────────────────────────────────────────────────────
  describe("project — after finalize", () => {
    it("silently drops events after finalize", async () => {
      const session = makeSession();
      await flushBackground();

      await session.finalize({ status: "succeeded" });

      await session.project({
        type: "log",
        message: "late event",
        level: "info",
        ts: Date.now(),
      } as any);

      const artifacts = await runsRepo.findArtifactsByRun("r1");
      expect(artifacts.find((a) => a.content === "late event")).toBeFalsy();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // finalize
  // ─────────────────────────────────────────────────────────────
  describe("finalize", () => {
    it("updates run status to the result status", async () => {
      const session = makeSession();
      await flushBackground();

      await session.finalize({ status: "succeeded" });

      const run = await runsRepo.findRunById("r1");
      expect(run!.status).toBe("succeeded");
      expect(run!.endedAt).toBeTruthy();
    });

    it("writes lastError on failed finalize", async () => {
      const session = makeSession();
      await flushBackground();

      await session.finalize({ status: "failed", summary: "kaboom" });

      const run = await runsRepo.findRunById("r1");
      expect(run!.status).toBe("failed");
      expect(run!.lastError).toBe("kaboom");
    });

    it("is idempotent — second call is a no-op", async () => {
      const session = makeSession();
      await flushBackground();

      await session.finalize({ status: "succeeded" });
      await session.finalize({ status: "failed", summary: "second call should not win" });

      const run = await runsRepo.findRunById("r1");
      expect(run!.status).toBe("succeeded");
    });

    it("unregisters from the registry", async () => {
      const session = makeSession();
      expect(runSessionRegistry.get("r1")).toBe(session);
      await flushBackground();

      await session.finalize({ status: "succeeded" });
      expect(runSessionRegistry.get("r1")).toBeUndefined();
    });

    it("closes orphaned tool calls as done on succeeded finalize", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Bash",
        metadata: { phase: "start", toolCallId: "tc-orphan" },
      } as any);
      // Never sent end event

      await session.finalize({ status: "succeeded" });

      const calls = await runsRepo.findToolCallsByRun("r1");
      expect(calls).toHaveLength(1);
      expect(calls[0].status).toBe("done");
    });

    it("closes orphaned tool calls as error on failed finalize", async () => {
      const session = makeSession();
      await flushBackground();

      await session.project({
        type: "tool_call",
        toolName: "Bash",
        metadata: { phase: "start", toolCallId: "tc-orphan" },
      } as any);

      await session.finalize({ status: "failed", summary: "boom" });

      const calls = await runsRepo.findToolCallsByRun("r1");
      expect(calls[0].status).toBe("error");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // abort
  // ─────────────────────────────────────────────────────────────
  describe("abort", () => {
    it("calls adapter.abortRun", async () => {
      const abortRun = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createWorkAdapter).mockReturnValue({ abortRun } as any);

      const session = makeSession();
      await flushBackground();

      await session.abort();

      expect(abortRun).toHaveBeenCalledWith("r1");
    });

    it("is idempotent — second call does not re-signal the adapter", async () => {
      const abortRun = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createWorkAdapter).mockReturnValue({ abortRun } as any);

      const session = makeSession();
      await flushBackground();

      await session.abort();
      await session.abort();

      expect(abortRun).toHaveBeenCalledTimes(1);
    });

    it("does not throw when adapter.abortRun rejects", async () => {
      const abortRun = vi.fn().mockRejectedValue(new Error("adapter explosion"));
      vi.mocked(createWorkAdapter).mockReturnValue({ abortRun } as any);

      const session = makeSession();
      await flushBackground();

      await expect(session.abort()).resolves.not.toThrow();
    });

    it("does not signal after finalize", async () => {
      const abortRun = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createWorkAdapter).mockReturnValue({ abortRun } as any);

      const session = makeSession();
      await flushBackground();

      await session.finalize({ status: "succeeded" });
      await session.abort();

      expect(abortRun).not.toHaveBeenCalled();
    });

    it("succeeds when adapter has no abortRun method", async () => {
      vi.mocked(createWorkAdapter).mockReturnValue({} as any);

      const session = makeSession();
      await flushBackground();

      await expect(session.abort()).resolves.not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateBaseRef
  // ─────────────────────────────────────────────────────────────
  describe("updateBaseRef", () => {
    it("affects subsequent diff snapshots", async () => {
      vi.mocked(gitService.getHeadSha).mockResolvedValue({
        success: true,
        data: "original-sha",
      });
      vi.mocked(gitService.getDiffSince).mockResolvedValue({ success: true, data: "diff" });
      vi.mocked(gitService.getChangedFilesSince).mockResolvedValue({
        success: true,
        data: ["file.ts"],
      });
      vi.mocked(gitService.getShortStatSince).mockResolvedValue({
        success: true,
        data: "1 file changed",
      });
      vi.mocked(gitService.getUntrackedFiles).mockResolvedValue({ success: true, data: [] });

      const session = makeSession();
      await flushBackground(); // initial baseRef captured

      session.updateBaseRef("new-sha");

      await session.finalize({ status: "succeeded" });

      // The final diff snapshot should have used the updated baseRef
      const calls = vi.mocked(gitService.getDiffSince).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toBe("new-sha");
    });

    it("is a no-op after finalize", async () => {
      const session = makeSession();
      await flushBackground();

      await session.finalize({ status: "succeeded" });

      expect(() => session.updateBaseRef("new-sha")).not.toThrow();
    });
  });
});
