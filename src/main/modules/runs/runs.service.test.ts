import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createProvider,
  createWorkspace,
  createRun,
  createRunContext,
  createRunArtifact,
  createToolCall,
  createRunTurn,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

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
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s, "utf-8"),
    decryptString: (b: Buffer) => b.toString("utf-8"),
  },
}));

vi.mock("../providers/adapters", () => ({
  createWorkAdapter: vi.fn(),
  couldModifyFiles: vi.fn().mockReturnValue(false),
}));

// gitService is throw-style: plain resolved values, rejects on failure.
vi.mock("../git/git.service", () => ({
  gitService: {
    getHeadSha: vi.fn(),
    captureDiffSnapshot: vi.fn(),
  },
}));

// Mock only the fire-and-forget side of the workspace aggregate.
// workspaceRepo runs against the real test DB so runs.service can find/update
// workspaces created via createWorkspace(...). createDiff and logWorkspaceActivity
// are stubbed so the diff/activity side effects don't try to do real work.
vi.mock("../workspace", async () => {
  const actual = await vi.importActual<typeof import("../workspace")>(
    "../workspace",
  );
  return {
    ...actual,
    workspaceService: {
      ...actual.workspaceService,
      createDiff: vi
        .fn()
        .mockResolvedValue({ success: true, data: "diff-id" }),
    },
    logWorkspaceActivity: vi.fn(),
  };
});

import { runsService } from "./runs.service";
import { runsRepo } from "./runs.repo";
import { runSessionRegistry } from "./run-session-registry";
import { createWorkAdapter } from "../providers/adapters";
import { gitService } from "../git/git.service";

describe("runsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    // Defaults for the throw-style git mock: no repo unless a test overrides,
    // and an empty snapshot so sessions that DO get a baseRef can finalize.
    vi.mocked(gitService.getHeadSha).mockRejectedValue(
      new Error("not a git repo"),
    );
    vi.mocked(gitService.captureDiffSnapshot).mockResolvedValue({
      baseRef: "",
      diffText: "",
      files: [],
      untrackedFiles: [],
      shortstat: "",
    });
    createAccount(db, { id: "default" });
    createProvider(db, { id: "copilot_cli" });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // Run Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAllRuns", () => {
    it("returns empty array when no runs", async () => {
      const result = await runsService.getAllRuns();
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns all runs", async () => {
      createRun(db, { id: "r1" });
      createRun(db, { id: "r2" });

      const result = await runsService.getAllRuns();
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      createRun(db, { id: "r1" });
      createRun(db, { id: "r2" });
      createRun(db, { id: "r3" });

      const result = await runsService.getAllRuns(2);
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findAllRuns").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getAllRuns();
      assertFail(result);
      expect(result.error).toBe("Failed to get runs");
    });
  });

  describe("getRunById", () => {
    it("returns run when found", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getRunById("r1");
      assertOk(result);
      expect(result.data!.id).toBe("r1");
    });

    it("returns error when not found", async () => {
      const result = await runsService.getRunById("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getRunById("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to get run");
    });
  });

  describe("getRunsByAccount", () => {
    it("returns runs for account", async () => {
      createRun(db, { id: "r1", accountId: "default" });

      const result = await runsService.getRunsByAccount("default");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty for unknown account", async () => {
      const result = await runsService.getRunsByAccount("unknown");
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("respects limit parameter", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      createRun(db, { id: "r2", accountId: "default" });
      createRun(db, { id: "r3", accountId: "default" });

      const result = await runsService.getRunsByAccount("default", 2);
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunsByAccount").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getRunsByAccount("default");
      assertFail(result);
      expect(result.error).toBe("Failed to get runs");
    });
  });

  describe("getRunsByWorkspace", () => {
    it("returns runs for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", workspaceId: ws.id });

      const result = await runsService.getRunsByWorkspace("ws1");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty for unknown workspace", async () => {
      const result = await runsService.getRunsByWorkspace("unknown-ws");
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunsByWorkspace").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getRunsByWorkspace("ws1");
      assertFail(result);
      expect(result.error).toBe("Failed to get runs");
    });
  });

  describe("getRunsByStatus", () => {
    it("returns runs filtered by status", async () => {
      createRun(db, { id: "r1", status: "running" });
      createRun(db, { id: "r2", status: "succeeded" });

      const result = await runsService.getRunsByStatus("default", "running");
      assertOk(result);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe("r1");
    });

    it("returns empty when no runs match status", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.getRunsByStatus("default", "failed");
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunsByStatus").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getRunsByStatus("default", "running");
      assertFail(result);
      expect(result.error).toBe("Failed to get runs");
    });
  });

  describe("createRun", () => {
    it("creates a run and returns id", async () => {
      const result = await runsService.createRun({
        id: "new-run-1",
        accountId: "default",
        providerId: "copilot_cli",
      });
      assertOk(result);
      expect(result.data).toBe("new-run-1");
    });

    it("creates a run with all optional fields", async () => {
      const ws = createWorkspace(db, { id: "ws1" });
      const result = await runsService.createRun({
        id: "new-run-2",
        accountId: "default",
        providerId: "copilot_cli",
        workspaceId: ws.id,
        model: "gpt-4",
        title: "Test run",
        goal: "Do something",
        status: "running",
        systemPrompt: "You are helpful",
      });
      assertOk(result);
      expect(result.data).toBe("new-run-2");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "insertRun").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.createRun({
        id: "fail-run",
        accountId: "default",
        providerId: "copilot_cli",
      });
      assertFail(result);
      expect(result.error).toBe("Failed to create run");
    });
  });

  describe("updateRun", () => {
    it("updates an existing run", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.updateRun("r1", { status: "running" });
      assertOk(result);
      expect(result.data!.status).toBe("running");
    });

    it("returns error for nonexistent run", async () => {
      const result = await runsService.updateRun("nonexistent", { status: "running" });
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });

    it("updates multiple fields", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.updateRun("r1", {
        status: "running",
        title: "Updated title",
        model: "claude-3",
      });
      assertOk(result);
      expect(result.data!.status).toBe("running");
      expect(result.data!.title).toBe("Updated title");
      expect(result.data!.model).toBe("claude-3");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "updateRun").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.updateRun("r1", { status: "running" });
      assertFail(result);
      expect(result.error).toBe("Failed to update run");
    });
  });

  describe("startRun", () => {
    it("sets status to running", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.startRun("r1");
      assertOk(result);
      expect(result.data!.status).toBe("running");
    });

    it("sets startedAt timestamp", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.startRun("r1");
      assertOk(result);
      expect(result.data!.startedAt).toBeTruthy();
    });

    it("returns error for nonexistent run", async () => {
      const result = await runsService.startRun("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });
  });

  describe("completeRun", () => {
    it("sets status to succeeded", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.completeRun("r1");
      assertOk(result);
      expect(result.data!.status).toBe("succeeded");
    });

    it("sets endedAt timestamp", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.completeRun("r1");
      assertOk(result);
      expect(result.data!.endedAt).toBeTruthy();
    });

    it("returns error for nonexistent run", async () => {
      const result = await runsService.completeRun("nonexistent");
      assertFail(result);
    });
  });

  describe("failRun", () => {
    it("sets status to failed with error", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.failRun("r1", "something broke");
      assertOk(result);
      expect(result.data!.status).toBe("failed");
      expect(result.data!.lastError).toBe("something broke");
    });

    it("sets endedAt timestamp", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.failRun("r1", "err");
      assertOk(result);
      expect(result.data!.endedAt).toBeTruthy();
    });

    it("returns error for nonexistent run", async () => {
      const result = await runsService.failRun("nonexistent", "err");
      assertFail(result);
    });
  });

  describe("cancelRun", () => {
    it("sets status to canceled", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.cancelRun("r1");
      assertOk(result);
      expect(result.data!.status).toBe("canceled");
    });

    it("sets endedAt timestamp", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.cancelRun("r1");
      assertOk(result);
      expect(result.data!.endedAt).toBeTruthy();
    });

    it("returns error for nonexistent run", async () => {
      const result = await runsService.cancelRun("nonexistent");
      assertFail(result);
    });
  });

  describe("deleteRun", () => {
    it("deletes an existing run", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.deleteRun("r1");
      assertOk(result);

      const check = await runsService.getRunById("r1");
      assertFail(check);
    });

    it("succeeds even when run does not exist", async () => {
      const result = await runsService.deleteRun("nonexistent");
      assertOk(result);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "deleteRun").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.deleteRun("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to delete run");
    });
  });

  describe("archiveRun", () => {
    it("archives an existing run", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.archiveRun("r1");
      assertOk(result);
      expect(result.data!.isArchived).toBe(true);
    });

    it("returns error for nonexistent run", async () => {
      const result = await runsService.archiveRun("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "archiveRun").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.archiveRun("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to archive run");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Context Operations
  // ─────────────────────────────────────────────────────────────
  describe("getContextByRun", () => {
    it("returns empty array when no context", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getContextByRun("r1");
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns context items", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });

      const result = await runsService.getContextByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });

    it("returns multiple context items", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "a.ts" });
      createRunContext(db, { runId: "r1", kind: "note", content: "some note" });

      const result = await runsService.getContextByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findContextByRun").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getContextByRun("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to get context");
    });
  });

  describe("addContext", () => {
    it("adds context and returns id", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addContext({
        runId: "r1",
        kind: "file",
        content: "src/test.ts",
      });
      assertOk(result);
      expect(typeof result.data).toBe("number");
    });

    it("adds context with metadata", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addContext({
        runId: "r1",
        kind: "note",
        content: "a note",
        metadata: { source: "manual" },
      });
      assertOk(result);
      expect(typeof result.data).toBe("number");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "insertContext").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.addContext({
        runId: "r1",
        kind: "file",
        content: "test.ts",
      });
      assertFail(result);
      expect(result.error).toBe("Failed to add context");
    });
  });

  describe("removeContext", () => {
    it("removes context", async () => {
      createRun(db, { id: "r1" });
      const ctx = createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });

      const result = await runsService.removeContext(ctx.id);
      assertOk(result);

      const check = await runsService.getContextByRun("r1");
      assertOk(check);
      expect(check.data).toEqual([]);
    });

    it("succeeds when context does not exist", async () => {
      const result = await runsService.removeContext(99999);
      assertOk(result);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "deleteContext").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.removeContext(1);
      assertFail(result);
      expect(result.error).toBe("Failed to remove context");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Artifact Operations
  // ─────────────────────────────────────────────────────────────
  describe("getArtifactsByRun", () => {
    it("returns empty array when no artifacts", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getArtifactsByRun("r1");
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns artifacts", async () => {
      createRun(db, { id: "r1" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "hello" });

      const result = await runsService.getArtifactsByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });

    it("returns multiple artifacts", async () => {
      createRun(db, { id: "r1" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "a" });
      createRunArtifact(db, { runId: "r1", kind: "log", content: "b" });

      const result = await runsService.getArtifactsByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findArtifactsByRun").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getArtifactsByRun("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to get artifacts");
    });
  });

  describe("addArtifact", () => {
    it("adds artifact and returns id", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addArtifact({
        runId: "r1",
        kind: "file",
        content: "console.log('hi')",
      });
      assertOk(result);
      expect(typeof result.data).toBe("number");
    });

    it("adds artifact with path", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addArtifact({
        runId: "r1",
        kind: "file",
        path: "/src/index.ts",
        content: "export {}",
      });
      assertOk(result);
      expect(typeof result.data).toBe("number");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "insertArtifact").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.addArtifact({
        runId: "r1",
        kind: "file",
        content: "test",
      });
      assertFail(result);
      expect(result.error).toBe("Failed to add artifact");
    });
  });

  describe("removeArtifact", () => {
    it("removes artifact", async () => {
      createRun(db, { id: "r1" });
      const art = createRunArtifact(db, { runId: "r1", kind: "file", content: "hello" });

      const result = await runsService.removeArtifact(art.id);
      assertOk(result);

      const check = await runsService.getArtifactsByRun("r1");
      assertOk(check);
      expect(check.data).toEqual([]);
    });

    it("succeeds when artifact does not exist", async () => {
      const result = await runsService.removeArtifact(99999);
      assertOk(result);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "deleteArtifact").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.removeArtifact(1);
      assertFail(result);
      expect(result.error).toBe("Failed to remove artifact");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tool Call Operations
  // ─────────────────────────────────────────────────────────────
  describe("getToolCallsByRun", () => {
    it("returns empty array when no tool calls", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getToolCallsByRun("r1");
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns tool calls", async () => {
      createRun(db, { id: "r1" });
      createToolCall(db, { runId: "r1", toolName: "read_file" });

      const result = await runsService.getToolCallsByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });

    it("returns multiple tool calls", async () => {
      createRun(db, { id: "r1" });
      createToolCall(db, { runId: "r1", toolName: "read_file" });
      createToolCall(db, { runId: "r1", toolName: "write_file" });

      const result = await runsService.getToolCallsByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findToolCallsByRun").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getToolCallsByRun("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to get tool calls");
    });
  });

  describe("addToolCall", () => {
    it("adds tool call and returns id", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addToolCall({
        accountId: "default",
        runId: "r1",
        toolName: "write_file",
      });
      assertOk(result);
      expect(typeof result.data).toBe("number");
    });

    it("adds tool call with input", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addToolCall({
        accountId: "default",
        runId: "r1",
        toolName: "Bash",
        input: { command: "ls" },
      });
      assertOk(result);
      expect(typeof result.data).toBe("number");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "insertToolCall").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.addToolCall({
        accountId: "default",
        runId: "r1",
        toolName: "write_file",
      });
      assertFail(result);
      expect(result.error).toBe("Failed to add tool call");
    });
  });

  describe("updateToolCall", () => {
    it("updates a tool call", async () => {
      createRun(db, { id: "r1" });
      const tc = createToolCall(db, { runId: "r1", toolName: "read_file" });

      const result = await runsService.updateToolCall(tc.id, { status: "done" });
      assertOk(result);
    });

    it("updates tool call with output and error", async () => {
      createRun(db, { id: "r1" });
      const tc = createToolCall(db, { runId: "r1", toolName: "read_file" });

      const result = await runsService.updateToolCall(tc.id, {
        status: "error",
        error: "file not found",
        output: { stderr: "No such file" },
      });
      assertOk(result);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "updateToolCall").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.updateToolCall(1, { status: "done" });
      assertFail(result);
      expect(result.error).toBe("Failed to update tool call");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Details
  // ─────────────────────────────────────────────────────────────
  describe("getRunDetails", () => {
    it("returns error for nonexistent run", async () => {
      const result = await runsService.getRunDetails("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });

    it("returns run with all related data", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "output" });
      createToolCall(db, { runId: "r1", toolName: "read" });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });

      const result = await runsService.getRunDetails("r1");
      assertOk(result);
      expect(result.data!.run.id).toBe("r1");
      expect(result.data!.context).toHaveLength(1);
      expect(result.data!.artifacts).toHaveLength(1);
      expect(result.data!.toolCalls).toHaveLength(1);
      expect(result.data!.turns).toHaveLength(1);
    });

    it("returns run with empty related data", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getRunDetails("r1");
      assertOk(result);
      expect(result.data!.run.id).toBe("r1");
      expect(result.data!.context).toEqual([]);
      expect(result.data!.artifacts).toEqual([]);
      expect(result.data!.toolCalls).toEqual([]);
      expect(result.data!.turns).toEqual([]);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getRunDetails("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to get run details");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Turns
  // ─────────────────────────────────────────────────────────────
  describe("getTurnsByRun", () => {
    it("returns empty array when no turns", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getTurnsByRun("r1");
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns turns for a run", async () => {
      createRun(db, { id: "r1" });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });
      createRunTurn(db, { runId: "r1", turnIndex: 1 });

      const result = await runsService.getTurnsByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("returns turns ordered by turnIndex", async () => {
      createRun(db, { id: "r1" });
      createRunTurn(db, { runId: "r1", turnIndex: 2 });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });
      createRunTurn(db, { runId: "r1", turnIndex: 1 });

      const result = await runsService.getTurnsByRun("r1");
      assertOk(result);
      expect(result.data![0].turnIndex).toBe(0);
      expect(result.data![1].turnIndex).toBe(1);
      expect(result.data![2].turnIndex).toBe(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findTurnsByRun").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.getTurnsByRun("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to get run turns");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // executeRun
  // ─────────────────────────────────────────────────────────────
  describe("executeRun", () => {
    const basePayload = () => ({
      accountId: "default",
      workspaceId: "ws1",
      providerId: "copilot_cli",
      goal: "Fix the bug",
    });

    function setupMockAdapter(overrides: Record<string, unknown> = {}) {
      const mockAdapter = {
        startRun: vi.fn().mockResolvedValue({
          status: "succeeded",
          summary: "Done",
          stopReason: "end_turn",
        }),
        generateTitle: vi.fn().mockResolvedValue("Generated Title"),
        abortRun: vi.fn(),
        canResumeSession: vi.fn().mockResolvedValue(true),
        continueRun: vi.fn(),
        forkRun: vi.fn(),
        deleteSession: vi.fn(),
        ...overrides,
      };
      vi.mocked(createWorkAdapter).mockReturnValue(mockAdapter as any);
      return mockAdapter;
    }

    it("returns error when provider not found", async () => {
      const result = await runsService.executeRun({
        ...basePayload(),
        providerId: "nonexistent",
      });
      assertFail(result);
      expect(result.error).toContain("not found");
    });

    it("returns error when provider is disabled", async () => {
      createProvider(db, { id: "disabled_provider", isEnabled: false, displayName: "Disabled" });

      const result = await runsService.executeRun({
        ...basePayload(),
        providerId: "disabled_provider",
      });
      assertFail(result);
      expect(result.error).toContain("not enabled");
    });

    it("returns error when provider is not agent_runtime", async () => {
      createProvider(db, { id: "non_runtime", kind: "tool" as any, displayName: "Tool Provider" });

      const result = await runsService.executeRun({
        ...basePayload(),
        providerId: "non_runtime",
      });
      assertFail(result);
      expect(result.error).toContain("not an agent runtime");
    });

    it("returns error when workspace not found", async () => {
      setupMockAdapter();

      const result = await runsService.executeRun({
        ...basePayload(),
        workspaceId: "nonexistent-ws",
      });
      assertFail(result);
      expect(result.error).toContain("not found");
    });

    it("returns runId on happy path", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter();

      const result = await runsService.executeRun(basePayload());
      assertOk(result);
      expect(result.data!.runId).toBeTruthy();
      await flushBackground();
    });

    it("calls adapter.startRun with correct params", async () => {
      createWorkspace(db, { id: "ws1", rootPath: "/tmp/ws/test" });
      const mockAdapter = setupMockAdapter();

      await runsService.executeRun(basePayload());
      expect(mockAdapter.startRun).toHaveBeenCalled();
      const callArgs = mockAdapter.startRun.mock.calls[0][0];
      expect(callArgs.goal).toBe("Fix the bug");
      expect(callArgs.workspace.id).toBe("ws1");
      await flushBackground();
    });

    it("persists initial context when provided", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter();

      const result = await runsService.executeRun({
        ...basePayload(),
        initialContext: [
          { kind: "file", ref: "src/index.ts", content: "export {}" },
          { kind: "note", content: "Focus on perf" },
        ],
      });
      assertOk(result);

      await flushBackground();
      const ctx = await runsRepo.findContextByRun(result.data!.runId);
      expect(ctx).toHaveLength(2);
    });

    it("creates run record in the database", async () => {
      createWorkspace(db, { id: "ws1" });
      // Use a never-resolving promise so the run stays in running state
      let resolveRun!: (v: any) => void;
      setupMockAdapter({
        startRun: vi.fn().mockReturnValue(new Promise((r) => { resolveRun = r; })),
      });

      const result = await runsService.executeRun(basePayload());
      assertOk(result);

      const run = await runsRepo.findRunById(result.data!.runId);
      expect(run).toBeTruthy();
      expect(run!.status).toBe("running");

      // Resolve so test cleanup doesn't hang
      resolveRun({ status: "succeeded", summary: "Done" });
      await flushBackground();
    });

    it("background .then() updates status to succeeded", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter();

      const result = await runsService.executeRun(basePayload());
      assertOk(result);
      await flushBackground();

      const run = await runsRepo.findRunById(result.data!.runId);
      expect(run!.status).toBe("succeeded");
    });

    it("background .then() updates status to canceled when adapter returns canceled", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter({
        startRun: vi.fn().mockResolvedValue({
          status: "canceled",
          summary: "Canceled by user",
        }),
      });

      const result = await runsService.executeRun(basePayload());
      assertOk(result);
      await flushBackground();

      const run = await runsRepo.findRunById(result.data!.runId);
      expect(run!.status).toBe("canceled");
    });

    it("background .then() updates status to failed when adapter returns failed", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter({
        startRun: vi.fn().mockResolvedValue({
          status: "failed",
          summary: "Something went wrong",
        }),
      });

      const result = await runsService.executeRun(basePayload());
      assertOk(result);
      await flushBackground();

      const run = await runsRepo.findRunById(result.data!.runId);
      expect(run!.status).toBe("failed");
      expect(run!.lastError).toBe("Something went wrong");
    });

    it("background .catch() marks run as failed", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter({
        startRun: vi.fn().mockRejectedValue(new Error("adapter crashed")),
      });

      const result = await runsService.executeRun(basePayload());
      assertOk(result);
      await flushBackground();

      const run = await runsRepo.findRunById(result.data!.runId);
      expect(run!.status).toBe("failed");
      expect(run!.lastError).toBe("adapter crashed");
    });

    it("fires title generation in background", async () => {
      createWorkspace(db, { id: "ws1" });
      const mockAdapter = setupMockAdapter();

      await runsService.executeRun(basePayload());
      await flushBackground();

      expect(mockAdapter.generateTitle).toHaveBeenCalledWith("Fix the bug", undefined);
    });

    it("uses fallback title when generateTitle is not present", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter({ generateTitle: undefined });

      const result = await runsService.executeRun(basePayload());
      assertOk(result);
      await flushBackground();

      const run = await runsRepo.findRunById(result.data!.runId);
      expect(run!.title).toBe("Fix the bug");
    });

    it("captures git base ref at run start", async () => {
      createWorkspace(db, { id: "ws1", rootPath: "/tmp/test-repo" });
      setupMockAdapter();
      vi.mocked(gitService.getHeadSha).mockResolvedValue("abc123");

      await runsService.executeRun(basePayload());
      expect(gitService.getHeadSha).toHaveBeenCalledWith("/tmp/test-repo");
      await flushBackground();
    });

    it("handles outer try-catch when insertRun throws", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter();
      vi.spyOn(runsRepo, "insertRun").mockRejectedValueOnce(new Error("insert failed"));

      const result = await runsService.executeRun(basePayload());
      assertFail(result);
      expect(result.error).toBe("insert failed");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Adapter-event projection (was handleRunEvent on the service)
  //
  // Tests for projection logic moved to run-session.test.ts when the
  // logic moved from runsService.handleRunEvent into RunSession.project.
  // See follow-up task. Smoke tests cover regressions in the meantime.
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // abortRun
  // ─────────────────────────────────────────────────────────────
  describe("abortRun", () => {
    it("returns error when run not found", async () => {
      const result = await runsService.abortRun("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });

    it("returns error when run is not running", async () => {
      createRun(db, { id: "r1", status: "succeeded" });

      const result = await runsService.abortRun("r1");
      assertFail(result);
      expect(result.error).toContain("not running");
    });

    it("returns error when run is queued", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.abortRun("r1");
      assertFail(result);
      expect(result.error).toContain("not running");
    });

    it("returns error when run is failed", async () => {
      createRun(db, { id: "r1", status: "failed" });

      const result = await runsService.abortRun("r1");
      assertFail(result);
      expect(result.error).toContain("not running");
    });

    it("delegates to session.abort when a live session is registered", async () => {
      createRun(db, { id: "r1", status: "running" });
      const sessionAbort = vi.fn().mockResolvedValue(undefined);
      runSessionRegistry.register("r1", {
        runId: "r1",
        project: vi.fn(),
        abort: sessionAbort,
        finalize: vi.fn(),
        updateBaseRef: vi.fn(),
      });

      const result = await runsService.abortRun("r1");

      assertOk(result);
      expect(sessionAbort).toHaveBeenCalledOnce();
      runSessionRegistry.unregister("r1");
    });

    it("marks status canceled directly when no live session (process-restart edge case)", async () => {
      createRun(db, { id: "r1", status: "running" });
      // No session registered — DB says running but in-memory state is gone.

      const result = await runsService.abortRun("r1");
      assertOk(result);

      const run = await runsRepo.findRunById("r1");
      expect(run!.status).toBe("canceled");
      expect(run!.lastError).toContain("no live session");
    });

    it("returns error on outer catch", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.abortRun("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to abort run");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // canResumeRun
  // ─────────────────────────────────────────────────────────────
  describe("canResumeRun", () => {
    it("returns error when run not found", async () => {
      const result = await runsService.canResumeRun("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });

    it("returns false for running status", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.canResumeRun("r1");
      assertOk(result);
      expect(result.data).toBe(false);
    });

    it("returns false for queued status", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.canResumeRun("r1");
      assertOk(result);
      expect(result.data).toBe(false);
    });

    it("returns false when provider not found", async () => {
      createProvider(db, { id: "temp_prov" });
      createRun(db, { id: "r1", status: "succeeded", providerId: "temp_prov" });
      vi.spyOn(
        await import("../providers/providers.repo").then(m => m.providersRepo),
        "findById"
      ).mockResolvedValueOnce(null);

      const result = await runsService.canResumeRun("r1");
      assertOk(result);
      expect(result.data).toBe(false);
    });

    it("returns false when adapter has no canResumeSession", async () => {
      createRun(db, { id: "r1", status: "succeeded" });
      vi.mocked(createWorkAdapter).mockReturnValue({} as any);

      const result = await runsService.canResumeRun("r1");
      assertOk(result);
      expect(result.data).toBe(false);
    });

    it("returns true when adapter says session is resumable", async () => {
      createRun(db, { id: "r1", status: "succeeded" });
      vi.mocked(createWorkAdapter).mockReturnValue({
        canResumeSession: vi.fn().mockResolvedValue(true),
      } as any);

      const result = await runsService.canResumeRun("r1");
      assertOk(result);
      expect(result.data).toBe(true);
    });

    it("returns false when adapter says session is not resumable", async () => {
      createRun(db, { id: "r1", status: "failed" });
      vi.mocked(createWorkAdapter).mockReturnValue({
        canResumeSession: vi.fn().mockResolvedValue(false),
      } as any);

      const result = await runsService.canResumeRun("r1");
      assertOk(result);
      expect(result.data).toBe(false);
    });

    it("returns error on outer catch", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.canResumeRun("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to check resume capability");
    });

    it("works for canceled run", async () => {
      createRun(db, { id: "r1", status: "canceled" });
      vi.mocked(createWorkAdapter).mockReturnValue({
        canResumeSession: vi.fn().mockResolvedValue(true),
      } as any);

      const result = await runsService.canResumeRun("r1");
      assertOk(result);
      expect(result.data).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // continueRun
  // ─────────────────────────────────────────────────────────────
  describe("continueRun", () => {
    function setupContinueAdapter(overrides: Record<string, unknown> = {}) {
      const mockAdapter = {
        continueRun: vi.fn().mockResolvedValue({
          status: "succeeded",
          summary: "Continued",
          stopReason: "end_turn",
        }),
        canResumeSession: vi.fn().mockResolvedValue(true),
        generateTitle: vi.fn().mockResolvedValue("Title"),
        abortRun: vi.fn(),
        deleteSession: vi.fn(),
        ...overrides,
      };
      vi.mocked(createWorkAdapter).mockReturnValue(mockAdapter as any);
      return mockAdapter;
    }

    it("returns error when run not found", async () => {
      const result = await runsService.continueRun({
        runId: "nonexistent",
        accountId: "default",
        message: "keep going",
      });
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });

    it("returns error when run does not belong to account", async () => {
      createAccount(db, { id: "other" });
      createRun(db, { id: "r1", accountId: "other" });

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      assertFail(result);
      expect(result.error).toBe("Run does not belong to this account");
    });

    it("returns error when provider not found", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      vi.spyOn(
        await import("../providers/providers.repo").then(m => m.providersRepo),
        "findById"
      ).mockResolvedValueOnce(null);

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      assertFail(result);
      expect(result.error).toContain("not found");
    });

    it("returns error when provider is disabled", async () => {
      createProvider(db, { id: "disabled_p", isEnabled: false, displayName: "Disabled" });
      createRun(db, { id: "r1", accountId: "default", providerId: "disabled_p" });

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      assertFail(result);
      expect(result.error).toContain("not enabled");
    });

    it("returns error when adapter has no continueRun", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      vi.mocked(createWorkAdapter).mockReturnValue({} as any);

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      assertFail(result);
      expect(result.error).toBe("Provider does not support session resumption");
    });

    it("returns error when canResumeSession returns false", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupContinueAdapter({
        canResumeSession: vi.fn().mockResolvedValue(false),
      });

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      assertFail(result);
      expect(result.error).toContain("cannot be resumed");
    });

    it("succeeds on happy path", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupContinueAdapter();

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "do more",
      });
      assertOk(result);
      expect(result.data!.runId).toBe("r1");
      expect(result.data!.resumed).toBe(true);
      await flushBackground();
    });

    it("calls adapter.continueRun with correct args", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      const mockAdapter = setupContinueAdapter();

      await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "extend work",
      });
      expect(mockAdapter.continueRun).toHaveBeenCalled();
      const callArgs = mockAdapter.continueRun.mock.calls[0][0];
      expect(callArgs.message).toBe("extend work");
      expect(callArgs.runId).toBe("r1");
      await flushBackground();
    });

    it("updates run status to running", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1", status: "succeeded" });
      setupContinueAdapter();

      await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });

      // The run should be running now (before background promise resolves)
      // but after background it'll be succeeded again
      await flushBackground();
    });

    it("background .then() updates to succeeded", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupContinueAdapter();

      await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      await flushBackground();

      const run = await runsRepo.findRunById("r1");
      expect(run!.status).toBe("succeeded");
    });

    it("background .catch() marks run as failed", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupContinueAdapter({
        continueRun: vi.fn().mockRejectedValue(new Error("continue crashed")),
      });

      await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      await flushBackground();

      const run = await runsRepo.findRunById("r1");
      expect(run!.status).toBe("failed");
      expect(run!.lastError).toBe("continue crashed");
    });

    it("persists additional context when provided", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupContinueAdapter();

      await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
        additionalContext: [
          { kind: "file", ref: "extra.ts", content: "extra content" },
        ],
      });

      const ctx = await runsRepo.findContextByRun("r1");
      expect(ctx.length).toBeGreaterThanOrEqual(1);
      await flushBackground();
    });

    it("works when no workspace attached to run", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupContinueAdapter();

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      assertOk(result);
      await flushBackground();
    });

    it("skips canResumeSession check when adapter lacks it", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupContinueAdapter({ canResumeSession: undefined });

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      assertOk(result);
      await flushBackground();
    });

    it("returns error on outer catch", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupContinueAdapter();
      // Make updateRun throw during the "set running" step
      const originalUpdateRun = runsRepo.updateRun.bind(runsRepo);
      let callCount = 0;
      vi.spyOn(runsRepo, "updateRun").mockImplementation(async (...args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("update failed");
        }
        return originalUpdateRun(...args);
      });

      const result = await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      assertFail(result);
      expect(result.error).toBe("update failed");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // forkRun
  // ─────────────────────────────────────────────────────────────
  describe("forkRun", () => {
    function setupForkAdapter(overrides: Record<string, unknown> = {}) {
      const mockAdapter = {
        forkRun: vi.fn().mockResolvedValue({
          status: "succeeded",
          summary: "Forked",
          stopReason: "end_turn",
        }),
        canResumeSession: vi.fn().mockResolvedValue(true),
        generateTitle: vi.fn().mockResolvedValue("Forked Title"),
        abortRun: vi.fn(),
        deleteSession: vi.fn(),
        ...overrides,
      };
      vi.mocked(createWorkAdapter).mockReturnValue(mockAdapter as any);
      return mockAdapter;
    }

    it("returns error when source run not found", async () => {
      const result = await runsService.forkRun({
        sourceRunId: "nonexistent",
        accountId: "default",
        message: "fork this",
      });
      assertFail(result);
      expect(result.error).toBe("Source run not found");
    });

    it("returns error when source run does not belong to account", async () => {
      createAccount(db, { id: "other" });
      createRun(db, { id: "r1", accountId: "other" });

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      assertFail(result);
      expect(result.error).toBe("Source run does not belong to this account");
    });

    it("returns error when provider not found", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      vi.spyOn(
        await import("../providers/providers.repo").then(m => m.providersRepo),
        "findById"
      ).mockResolvedValueOnce(null);

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      assertFail(result);
      expect(result.error).toContain("not found");
    });

    it("returns error when provider is disabled", async () => {
      createProvider(db, { id: "disabled_p2", isEnabled: false, displayName: "Disabled" });
      createRun(db, { id: "r1", accountId: "default", providerId: "disabled_p2" });

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      assertFail(result);
      expect(result.error).toContain("not enabled");
    });

    it("returns error when adapter has no forkRun", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      vi.mocked(createWorkAdapter).mockReturnValue({ canResumeSession: vi.fn() } as any);

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      assertFail(result);
      expect(result.error).toBe("Provider does not support session forking");
    });

    it("returns error when canResumeSession returns false", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupForkAdapter({
        canResumeSession: vi.fn().mockResolvedValue(false),
      });

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      assertFail(result);
      expect(result.error).toContain("cannot be forked");
    });

    it("succeeds on happy path", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupForkAdapter();

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork and continue",
      });
      assertOk(result);
      expect(result.data!.runId).toBeTruthy();
      expect(result.data!.sourceRunId).toBe("r1");
      await flushBackground();
    });

    it("creates new run record", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupForkAdapter();

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork it",
      });
      assertOk(result);

      const newRun = await runsRepo.findRunById(result.data!.runId);
      expect(newRun).toBeTruthy();
      expect(newRun!.goal).toBe("fork it");
      await flushBackground();
    });

    it("calls adapter.forkRun", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      const mockAdapter = setupForkAdapter();

      await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      expect(mockAdapter.forkRun).toHaveBeenCalled();
      const callArgs = mockAdapter.forkRun.mock.calls[0][0];
      expect(callArgs.sourceRunId).toBe("r1");
      expect(callArgs.message).toBe("fork");
      await flushBackground();
    });

    it("background .then() updates forked run to succeeded", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupForkAdapter();

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      await flushBackground();

      assertOk(result);
      const run = await runsRepo.findRunById(result.data.runId);
      expect(run!.status).toBe("succeeded");
    });

    it("background .catch() marks forked run as failed", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupForkAdapter({
        forkRun: vi.fn().mockRejectedValue(new Error("fork crashed")),
      });

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      await flushBackground();

      assertOk(result);
      const run = await runsRepo.findRunById(result.data.runId);
      expect(run!.status).toBe("failed");
      expect(run!.lastError).toBe("fork crashed");
    });

    it("skips canResumeSession check when adapter lacks it", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupForkAdapter({ canResumeSession: undefined });

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      assertOk(result);
      await flushBackground();
    });

    it("works when no workspace attached to source run", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupForkAdapter();

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      assertOk(result);
      await flushBackground();
    });

    it("returns error on outer catch", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupForkAdapter();
      vi.spyOn(runsRepo, "insertRun").mockRejectedValueOnce(new Error("insert failed"));

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      assertFail(result);
      expect(result.error).toBe("insert failed");
    });

    it("fires title generation in background for forked run", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      const mockAdapter = setupForkAdapter();

      await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "forked goal",
      });
      await flushBackground();

      expect(mockAdapter.generateTitle).toHaveBeenCalledWith("forked goal", undefined);
    });

    it("background .then() sets canceled status when adapter returns canceled", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupForkAdapter({
        forkRun: vi.fn().mockResolvedValue({
          status: "canceled",
          summary: "Canceled",
        }),
      });

      const result = await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      await flushBackground();

      assertOk(result);
      const run = await runsRepo.findRunById(result.data.runId);
      expect(run!.status).toBe("canceled");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deleteRunSession
  // ─────────────────────────────────────────────────────────────
  describe("deleteRunSession", () => {
    it("returns error when run not found", async () => {
      const result = await runsService.deleteRunSession("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Run not found");
    });

    it("returns success when provider not found", async () => {
      createRun(db, { id: "r1" });
      vi.spyOn(
        await import("../providers/providers.repo").then(m => m.providersRepo),
        "findById"
      ).mockResolvedValueOnce(null);

      const result = await runsService.deleteRunSession("r1");
      assertOk(result);
    });

    it("calls adapter.deleteSession when available", async () => {
      createRun(db, { id: "r1" });
      const mockAdapter = {
        deleteSession: vi.fn(),
      };
      vi.mocked(createWorkAdapter).mockReturnValue(mockAdapter as any);

      const result = await runsService.deleteRunSession("r1");
      assertOk(result);
      expect(mockAdapter.deleteSession).toHaveBeenCalledWith("r1");
    });

    it("succeeds when adapter has no deleteSession", async () => {
      createRun(db, { id: "r1" });
      vi.mocked(createWorkAdapter).mockReturnValue({} as any);

      const result = await runsService.deleteRunSession("r1");
      assertOk(result);
    });

    it("returns error on outer catch", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      const result = await runsService.deleteRunSession("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to delete session");
    });

    it("returns error when adapter.deleteSession throws", async () => {
      createRun(db, { id: "r1" });
      vi.mocked(createWorkAdapter).mockReturnValue({
        deleteSession: vi.fn().mockRejectedValue(new Error("delete failed")),
      } as any);

      const result = await runsService.deleteRunSession("r1");
      assertFail(result);
      expect(result.error).toBe("Failed to delete session");
    });
  });
});
