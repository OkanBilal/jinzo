import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync } from "fs";
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

// Workspace fixtures use synthetic /tmp/ws/<uuid> paths that were never created
// on disk, so the real filesystem would report every one of them missing and the
// run-start guard would reject them. Default to "present" and let the guard's own
// tests flip this.
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn(() => true) };
});

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
    // Workspace folders exist unless a test says otherwise (see the fs mock).
    vi.mocked(existsSync).mockReturnValue(true);
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
      expect(result).toEqual([]);
    });

    it("returns all runs", async () => {
      createRun(db, { id: "r1" });
      createRun(db, { id: "r2" });

      const result = await runsService.getAllRuns();
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      createRun(db, { id: "r1" });
      createRun(db, { id: "r2" });
      createRun(db, { id: "r3" });

      const result = await runsService.getAllRuns(2);
      expect(result).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findAllRuns").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getAllRuns()).rejects.toThrow("db error");
    });
  });

  describe("getRunById", () => {
    it("returns run when found", async () => {
      createRun(db, { id: "r1" });

      const result = (await runsService.getRunById("r1"))!;
      expect(result.id).toBe("r1");
    });

    it("returns error when not found", async () => {
      expect(await runsService.getRunById("nonexistent")).toBeNull();
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getRunById("r1")).rejects.toThrow("db error");
    });
  });

  describe("getRunsByAccount", () => {
    it("returns runs for account", async () => {
      createRun(db, { id: "r1", accountId: "default" });

      const result = await runsService.getRunsByAccount("default");
      expect(result).toHaveLength(1);
    });

    it("returns empty for unknown account", async () => {
      const result = await runsService.getRunsByAccount("unknown");
      expect(result).toEqual([]);
    });

    it("respects limit parameter", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      createRun(db, { id: "r2", accountId: "default" });
      createRun(db, { id: "r3", accountId: "default" });

      const result = await runsService.getRunsByAccount("default", 2);
      expect(result).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunsByAccount").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getRunsByAccount("default")).rejects.toThrow("db error");
    });
  });

  describe("getRunsByWorkspace", () => {
    it("returns runs for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", workspaceId: ws.id });

      const result = await runsService.getRunsByWorkspace("ws1");
      expect(result).toHaveLength(1);
    });

    it("returns empty for unknown workspace", async () => {
      const result = await runsService.getRunsByWorkspace("unknown-ws");
      expect(result).toEqual([]);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunsByWorkspace").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getRunsByWorkspace("ws1")).rejects.toThrow("db error");
    });
  });

  describe("getRunsByStatus", () => {
    it("returns runs filtered by status", async () => {
      createRun(db, { id: "r1", status: "running" });
      createRun(db, { id: "r2", status: "succeeded" });

      const result = await runsService.getRunsByStatus("default", "running");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("r1");
    });

    it("returns empty when no runs match status", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.getRunsByStatus("default", "failed");
      expect(result).toEqual([]);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunsByStatus").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getRunsByStatus("default", "running")).rejects.toThrow("db error");
    });
  });

  describe("createRun", () => {
    it("creates a run and returns id", async () => {
      const result = await runsService.createRun({
        id: "new-run-1",
        accountId: "default",
        providerId: "copilot_cli",
      });
      expect(result).toBe("new-run-1");
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
      expect(result).toBe("new-run-2");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "insertRun").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.createRun({ id: "fail-run", accountId: "default", providerId: "copilot_cli", })).rejects.toThrow("db error");
    });
  });

  describe("updateRun", () => {
    it("updates an existing run", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.updateRun("r1", { status: "running" });
      expect(result.status).toBe("running");
    });

    it("returns error for nonexistent run", async () => {
      await expect(runsService.updateRun("nonexistent", { status: "running" })).rejects.toThrow("Run not found");
    });

    it("updates multiple fields", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.updateRun("r1", {
        status: "running",
        title: "Updated title",
        model: "claude-3",
      });
      expect(result.status).toBe("running");
      expect(result.title).toBe("Updated title");
      expect(result.model).toBe("claude-3");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "updateRun").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.updateRun("r1", { status: "running" })).rejects.toThrow("db error");
    });
  });

  describe("startRun", () => {
    it("sets status to running", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.startRun("r1");
      expect(result.status).toBe("running");
    });

    it("sets startedAt timestamp", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.startRun("r1");
      expect(result.startedAt).toBeTruthy();
    });

    it("returns error for nonexistent run", async () => {
      await expect(runsService.startRun("nonexistent")).rejects.toThrow("Run not found");
    });
  });

  describe("completeRun", () => {
    it("sets status to succeeded", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.completeRun("r1");
      expect(result.status).toBe("succeeded");
    });

    it("sets endedAt timestamp", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.completeRun("r1");
      expect(result.endedAt).toBeTruthy();
    });

    it("returns error for nonexistent run", async () => {
      await expect(runsService.completeRun("nonexistent")).rejects.toThrow();
    });
  });

  describe("failRun", () => {
    it("sets status to failed with error", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.failRun("r1", "something broke");
      expect(result.status).toBe("failed");
      expect(result.lastError).toBe("something broke");
    });

    it("sets endedAt timestamp", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.failRun("r1", "err");
      expect(result.endedAt).toBeTruthy();
    });

    it("returns error for nonexistent run", async () => {
      await expect(runsService.failRun("nonexistent", "err")).rejects.toThrow();
    });
  });

  describe("cancelRun", () => {
    it("sets status to canceled", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.cancelRun("r1");
      expect(result.status).toBe("canceled");
    });

    it("sets endedAt timestamp", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.cancelRun("r1");
      expect(result.endedAt).toBeTruthy();
    });

    it("returns error for nonexistent run", async () => {
      await expect(runsService.cancelRun("nonexistent")).rejects.toThrow();
    });
  });

  describe("deleteRun", () => {
    it("deletes an existing run", async () => {
      createRun(db, { id: "r1" });

      await runsService.deleteRun("r1");

      expect(await runsService.getRunById("r1")).toBeNull();
    });

    it("succeeds even when run does not exist", async () => {
      await runsService.deleteRun("nonexistent");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "deleteRun").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.deleteRun("r1")).rejects.toThrow("db error");
    });
  });

  describe("archiveRun", () => {
    it("archives an existing run", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.archiveRun("r1");
      expect(result.isArchived).toBe(true);
    });

    it("returns error for nonexistent run", async () => {
      await expect(runsService.archiveRun("nonexistent")).rejects.toThrow("Run not found");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "archiveRun").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.archiveRun("r1")).rejects.toThrow("db error");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Context Operations
  // ─────────────────────────────────────────────────────────────
  describe("getContextByRun", () => {
    it("returns empty array when no context", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getContextByRun("r1");
      expect(result).toEqual([]);
    });

    it("returns context items", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });

      const result = await runsService.getContextByRun("r1");
      expect(result).toHaveLength(1);
    });

    it("returns multiple context items", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "a.ts" });
      createRunContext(db, { runId: "r1", kind: "note", content: "some note" });

      const result = await runsService.getContextByRun("r1");
      expect(result).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findContextByRun").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getContextByRun("r1")).rejects.toThrow("db error");
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
      expect(typeof result).toBe("number");
    });

    it("adds context with metadata", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addContext({
        runId: "r1",
        kind: "note",
        content: "a note",
        metadata: { source: "manual" },
      });
      expect(typeof result).toBe("number");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "insertContext").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.addContext({ runId: "r1", kind: "file", content: "test.ts", })).rejects.toThrow("db error");
    });
  });

  describe("removeContext", () => {
    it("removes context", async () => {
      createRun(db, { id: "r1" });
      const ctx = createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });

      await runsService.removeContext(ctx.id);

      const check = await runsService.getContextByRun("r1");
      expect(check).toEqual([]);
    });

    it("succeeds when context does not exist", async () => {
      await runsService.removeContext(99999);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "deleteContext").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.removeContext(1)).rejects.toThrow("db error");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Artifact Operations
  // ─────────────────────────────────────────────────────────────
  describe("getArtifactsByRun", () => {
    it("returns empty array when no artifacts", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getArtifactsByRun("r1");
      expect(result).toEqual([]);
    });

    it("returns artifacts", async () => {
      createRun(db, { id: "r1" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "hello" });

      const result = await runsService.getArtifactsByRun("r1");
      expect(result).toHaveLength(1);
    });

    it("returns multiple artifacts", async () => {
      createRun(db, { id: "r1" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "a" });
      createRunArtifact(db, { runId: "r1", kind: "log", content: "b" });

      const result = await runsService.getArtifactsByRun("r1");
      expect(result).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findArtifactsByRun").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getArtifactsByRun("r1")).rejects.toThrow("db error");
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
      expect(typeof result).toBe("number");
    });

    it("adds artifact with path", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addArtifact({
        runId: "r1",
        kind: "file",
        path: "/src/index.ts",
        content: "export {}",
      });
      expect(typeof result).toBe("number");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "insertArtifact").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.addArtifact({ runId: "r1", kind: "file", content: "test", })).rejects.toThrow("db error");
    });
  });

  describe("removeArtifact", () => {
    it("removes artifact", async () => {
      createRun(db, { id: "r1" });
      const art = createRunArtifact(db, { runId: "r1", kind: "file", content: "hello" });

      await runsService.removeArtifact(art.id);

      const check = await runsService.getArtifactsByRun("r1");
      expect(check).toEqual([]);
    });

    it("succeeds when artifact does not exist", async () => {
      await runsService.removeArtifact(99999);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "deleteArtifact").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.removeArtifact(1)).rejects.toThrow("db error");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tool Call Operations
  // ─────────────────────────────────────────────────────────────
  describe("getToolCallsByRun", () => {
    it("returns empty array when no tool calls", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getToolCallsByRun("r1");
      expect(result).toEqual([]);
    });

    it("returns tool calls", async () => {
      createRun(db, { id: "r1" });
      createToolCall(db, { runId: "r1", toolName: "read_file" });

      const result = await runsService.getToolCallsByRun("r1");
      expect(result).toHaveLength(1);
    });

    it("returns multiple tool calls", async () => {
      createRun(db, { id: "r1" });
      createToolCall(db, { runId: "r1", toolName: "read_file" });
      createToolCall(db, { runId: "r1", toolName: "write_file" });

      const result = await runsService.getToolCallsByRun("r1");
      expect(result).toHaveLength(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findToolCallsByRun").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getToolCallsByRun("r1")).rejects.toThrow("db error");
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
      expect(typeof result).toBe("number");
    });

    it("adds tool call with input", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.addToolCall({
        accountId: "default",
        runId: "r1",
        toolName: "Bash",
        input: { command: "ls" },
      });
      expect(typeof result).toBe("number");
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "insertToolCall").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.addToolCall({ accountId: "default", runId: "r1", toolName: "write_file", })).rejects.toThrow("db error");
    });
  });

  describe("updateToolCall", () => {
    it("updates a tool call", async () => {
      createRun(db, { id: "r1" });
      const tc = createToolCall(db, { runId: "r1", toolName: "read_file" });

      await runsService.updateToolCall(tc.id, { status: "done" });
    });

    it("updates tool call with output and error", async () => {
      createRun(db, { id: "r1" });
      const tc = createToolCall(db, { runId: "r1", toolName: "read_file" });

      await runsService.updateToolCall(tc.id, {
        status: "error",
        error: "file not found",
        output: { stderr: "No such file" },
      });
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "updateToolCall").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.updateToolCall(1, { status: "done" })).rejects.toThrow("db error");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Details
  // ─────────────────────────────────────────────────────────────
  describe("getRunDetails", () => {
    it("returns error for nonexistent run", async () => {
      expect(await runsService.getRunDetails("nonexistent")).toBeNull();
    });

    it("returns run with all related data", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "output" });
      createToolCall(db, { runId: "r1", toolName: "read" });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });

      const result = (await runsService.getRunDetails("r1"))!;
      expect(result.run.id).toBe("r1");
      expect(result.context).toHaveLength(1);
      expect(result.artifacts).toHaveLength(1);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.turns).toHaveLength(1);
    });

    it("returns run with empty related data", async () => {
      createRun(db, { id: "r1" });

      const result = (await runsService.getRunDetails("r1"))!;
      expect(result.run.id).toBe("r1");
      expect(result.context).toEqual([]);
      expect(result.artifacts).toEqual([]);
      expect(result.toolCalls).toEqual([]);
      expect(result.turns).toEqual([]);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getRunDetails("r1")).rejects.toThrow("db error");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Turns
  // ─────────────────────────────────────────────────────────────
  describe("getTurnsByRun", () => {
    it("returns empty array when no turns", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getTurnsByRun("r1");
      expect(result).toEqual([]);
    });

    it("returns turns for a run", async () => {
      createRun(db, { id: "r1" });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });
      createRunTurn(db, { runId: "r1", turnIndex: 1 });

      const result = await runsService.getTurnsByRun("r1");
      expect(result).toHaveLength(2);
    });

    it("returns turns ordered by turnIndex", async () => {
      createRun(db, { id: "r1" });
      createRunTurn(db, { runId: "r1", turnIndex: 2 });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });
      createRunTurn(db, { runId: "r1", turnIndex: 1 });

      const result = await runsService.getTurnsByRun("r1");
      expect(result[0].turnIndex).toBe(0);
      expect(result[1].turnIndex).toBe(1);
      expect(result[2].turnIndex).toBe(2);
    });

    it("returns error when repo throws", async () => {
      vi.spyOn(runsRepo, "findTurnsByRun").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.getTurnsByRun("r1")).rejects.toThrow("db error");
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
      await expect(runsService.executeRun({ ...basePayload(), providerId: "nonexistent", })).rejects.toThrow("not found");
    });

    it("returns error when provider is disabled", async () => {
      createProvider(db, { id: "disabled_provider", isEnabled: false, displayName: "Disabled" });

      await expect(runsService.executeRun({ ...basePayload(), providerId: "disabled_provider", })).rejects.toThrow("not enabled");
    });

    it("returns error when provider is not agent_runtime", async () => {
      createProvider(db, { id: "non_runtime", kind: "tool" as any, displayName: "Tool Provider" });

      await expect(runsService.executeRun({ ...basePayload(), providerId: "non_runtime", })).rejects.toThrow("not an agent runtime");
    });

    it("returns error when workspace not found", async () => {
      setupMockAdapter();

      await expect(runsService.executeRun({ ...basePayload(), workspaceId: "nonexistent-ws", })).rejects.toThrow("not found");
    });

    it("returns runId on happy path", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter();

      const result = await runsService.executeRun(basePayload());
      expect(result.runId).toBeTruthy();
      await flushBackground();
    });

    // Handing a deleted directory to an adapter starts a run that can only fail,
    // and fails obscurely — the error surfaces from inside the provider instead
    // of naming the folder. Refuse up front, before any row is written.
    describe("workspace folder deleted", () => {
      it("refuses to start and names the folder", async () => {
        createWorkspace(db, { id: "ws-gone", name: "Ghost", rootPath: "/repos/gone" });
        const adapter = setupMockAdapter();
        vi.mocked(existsSync).mockReturnValue(false);

        await expect(
          runsService.executeRun({ ...basePayload(), workspaceId: "ws-gone" }),
        ).rejects.toThrow(/"Ghost".*\/repos\/gone/s);
        expect(adapter.startRun).not.toHaveBeenCalled();
      });

      it("writes no run row when it refuses", async () => {
        createWorkspace(db, { id: "ws-gone2", rootPath: "/repos/gone2" });
        setupMockAdapter();
        vi.mocked(existsSync).mockReturnValue(false);

        await expect(
          runsService.executeRun({ ...basePayload(), workspaceId: "ws-gone2" }),
        ).rejects.toThrow(/no longer exists/);
        await expect(runsRepo.findRunsByWorkspace("ws-gone2")).resolves.toEqual([]);
      });
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

      await flushBackground();
      const ctx = await runsRepo.findContextByRun(result.runId);
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

      const run = await runsRepo.findRunById(result.runId);
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
      await flushBackground();

      const run = await runsRepo.findRunById(result.runId);
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
      await flushBackground();

      const run = await runsRepo.findRunById(result.runId);
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
      await flushBackground();

      const run = await runsRepo.findRunById(result.runId);
      expect(run!.status).toBe("failed");
      expect(run!.lastError).toBe("Something went wrong");
    });

    it("background .catch() marks run as failed", async () => {
      createWorkspace(db, { id: "ws1" });
      setupMockAdapter({
        startRun: vi.fn().mockRejectedValue(new Error("adapter crashed")),
      });

      const result = await runsService.executeRun(basePayload());
      await flushBackground();

      const run = await runsRepo.findRunById(result.runId);
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
      await flushBackground();

      const run = await runsRepo.findRunById(result.runId);
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

      await expect(runsService.executeRun(basePayload())).rejects.toThrow("insert failed");
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
      await expect(runsService.abortRun("nonexistent")).rejects.toThrow("Run not found");
    });

    it("returns error when run is not running", async () => {
      createRun(db, { id: "r1", status: "succeeded" });

      await expect(runsService.abortRun("r1")).rejects.toThrow("not running");
    });

    it("returns error when run is queued", async () => {
      createRun(db, { id: "r1", status: "queued" });

      await expect(runsService.abortRun("r1")).rejects.toThrow("not running");
    });

    it("returns error when run is failed", async () => {
      createRun(db, { id: "r1", status: "failed" });

      await expect(runsService.abortRun("r1")).rejects.toThrow("not running");
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

      await runsService.abortRun("r1");
      expect(sessionAbort).toHaveBeenCalledOnce();
      runSessionRegistry.unregister("r1");
    });

    it("marks status canceled directly when no live session (process-restart edge case)", async () => {
      createRun(db, { id: "r1", status: "running" });
      // No session registered — DB says running but in-memory state is gone.

      await runsService.abortRun("r1");

      const run = await runsRepo.findRunById("r1");
      expect(run!.status).toBe("canceled");
      expect(run!.lastError).toContain("no live session");
    });

    it("returns error on outer catch", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.abortRun("r1")).rejects.toThrow("db error");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // canResumeRun
  // ─────────────────────────────────────────────────────────────
  describe("canResumeRun", () => {
    it("returns false when run not found", async () => {
      expect(await runsService.canResumeRun("nonexistent")).toBe(false);
    });

    it("returns false for running status", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.canResumeRun("r1");
      expect(result).toBe(false);
    });

    it("returns false for queued status", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.canResumeRun("r1");
      expect(result).toBe(false);
    });

    it("returns false when provider not found", async () => {
      createProvider(db, { id: "temp_prov" });
      createRun(db, { id: "r1", status: "succeeded", providerId: "temp_prov" });
      vi.spyOn(
        await import("../providers/providers.repo").then(m => m.providersRepo),
        "findById"
      ).mockResolvedValueOnce(null);

      const result = await runsService.canResumeRun("r1");
      expect(result).toBe(false);
    });

    it("returns false when adapter has no canResumeSession", async () => {
      createRun(db, { id: "r1", status: "succeeded" });
      vi.mocked(createWorkAdapter).mockReturnValue({} as any);

      const result = await runsService.canResumeRun("r1");
      expect(result).toBe(false);
    });

    it("returns true when adapter says session is resumable", async () => {
      createRun(db, { id: "r1", status: "succeeded" });
      vi.mocked(createWorkAdapter).mockReturnValue({
        canResumeSession: vi.fn().mockResolvedValue(true),
      } as any);

      const result = await runsService.canResumeRun("r1");
      expect(result).toBe(true);
    });

    it("returns false when adapter says session is not resumable", async () => {
      createRun(db, { id: "r1", status: "failed" });
      vi.mocked(createWorkAdapter).mockReturnValue({
        canResumeSession: vi.fn().mockResolvedValue(false),
      } as any);

      const result = await runsService.canResumeRun("r1");
      expect(result).toBe(false);
    });

    it("returns error on outer catch", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.canResumeRun("r1")).rejects.toThrow("db error");
    });

    it("works for canceled run", async () => {
      createRun(db, { id: "r1", status: "canceled" });
      vi.mocked(createWorkAdapter).mockReturnValue({
        canResumeSession: vi.fn().mockResolvedValue(true),
      } as any);

      const result = await runsService.canResumeRun("r1");
      expect(result).toBe(true);
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
      await expect(runsService.continueRun({ runId: "nonexistent", accountId: "default", message: "keep going", })).rejects.toThrow("Run not found");
    });

    it("returns error when run does not belong to account", async () => {
      createAccount(db, { id: "other" });
      createRun(db, { id: "r1", accountId: "other" });

      await expect(runsService.continueRun({ runId: "r1", accountId: "default", message: "continue", })).rejects.toThrow("Run does not belong to this account");
    });

    it("returns error when provider not found", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      vi.spyOn(
        await import("../providers/providers.repo").then(m => m.providersRepo),
        "findById"
      ).mockResolvedValueOnce(null);

      await expect(runsService.continueRun({ runId: "r1", accountId: "default", message: "continue", })).rejects.toThrow("not found");
    });

    it("returns error when provider is disabled", async () => {
      createProvider(db, { id: "disabled_p", isEnabled: false, displayName: "Disabled" });
      createRun(db, { id: "r1", accountId: "default", providerId: "disabled_p" });

      await expect(runsService.continueRun({ runId: "r1", accountId: "default", message: "continue", })).rejects.toThrow("not enabled");
    });

    it("returns error when adapter has no continueRun", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      vi.mocked(createWorkAdapter).mockReturnValue({} as any);

      await expect(runsService.continueRun({ runId: "r1", accountId: "default", message: "continue", })).rejects.toThrow("Provider does not support session resumption");
    });

    it("returns error when canResumeSession returns false", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupContinueAdapter({
        canResumeSession: vi.fn().mockResolvedValue(false),
      });

      await expect(runsService.continueRun({ runId: "r1", accountId: "default", message: "continue", })).rejects.toThrow("cannot be resumed");
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
      expect(result.runId).toBe("r1");
      expect(result.resumed).toBe(true);
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

      await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
      await flushBackground();
    });

    it("skips canResumeSession check when adapter lacks it", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupContinueAdapter({ canResumeSession: undefined });

      await runsService.continueRun({
        runId: "r1",
        accountId: "default",
        message: "continue",
      });
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

      await expect(runsService.continueRun({ runId: "r1", accountId: "default", message: "continue", })).rejects.toThrow("update failed");
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
      await expect(runsService.forkRun({ sourceRunId: "nonexistent", accountId: "default", message: "fork this", })).rejects.toThrow("Source run not found");
    });

    it("returns error when source run does not belong to account", async () => {
      createAccount(db, { id: "other" });
      createRun(db, { id: "r1", accountId: "other" });

      await expect(runsService.forkRun({ sourceRunId: "r1", accountId: "default", message: "fork", })).rejects.toThrow("Source run does not belong to this account");
    });

    it("returns error when provider not found", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      vi.spyOn(
        await import("../providers/providers.repo").then(m => m.providersRepo),
        "findById"
      ).mockResolvedValueOnce(null);

      await expect(runsService.forkRun({ sourceRunId: "r1", accountId: "default", message: "fork", })).rejects.toThrow("not found");
    });

    it("returns error when provider is disabled", async () => {
      createProvider(db, { id: "disabled_p2", isEnabled: false, displayName: "Disabled" });
      createRun(db, { id: "r1", accountId: "default", providerId: "disabled_p2" });

      await expect(runsService.forkRun({ sourceRunId: "r1", accountId: "default", message: "fork", })).rejects.toThrow("not enabled");
    });

    it("returns error when adapter has no forkRun", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      vi.mocked(createWorkAdapter).mockReturnValue({ canResumeSession: vi.fn() } as any);

      await expect(runsService.forkRun({ sourceRunId: "r1", accountId: "default", message: "fork", })).rejects.toThrow("Provider does not support session forking");
    });

    it("returns error when canResumeSession returns false", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupForkAdapter({
        canResumeSession: vi.fn().mockResolvedValue(false),
      });

      await expect(runsService.forkRun({ sourceRunId: "r1", accountId: "default", message: "fork", })).rejects.toThrow("cannot be forked");
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
      expect(result.runId).toBeTruthy();
      expect(result.sourceRunId).toBe("r1");
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

      const newRun = await runsRepo.findRunById(result.runId);
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
      const run = await runsRepo.findRunById(result.runId);
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
      const run = await runsRepo.findRunById(result.runId);
      expect(run!.status).toBe("failed");
      expect(run!.lastError).toBe("fork crashed");
    });

    it("skips canResumeSession check when adapter lacks it", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", accountId: "default", workspaceId: "ws1" });
      setupForkAdapter({ canResumeSession: undefined });

      await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      await flushBackground();
    });

    it("works when no workspace attached to source run", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupForkAdapter();

      await runsService.forkRun({
        sourceRunId: "r1",
        accountId: "default",
        message: "fork",
      });
      await flushBackground();
    });

    it("returns error on outer catch", async () => {
      createRun(db, { id: "r1", accountId: "default" });
      setupForkAdapter();
      vi.spyOn(runsRepo, "insertRun").mockRejectedValueOnce(new Error("insert failed"));

      await expect(runsService.forkRun({ sourceRunId: "r1", accountId: "default", message: "fork", })).rejects.toThrow("insert failed");
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
      const run = await runsRepo.findRunById(result.runId);
      expect(run!.status).toBe("canceled");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deleteRunSession
  // ─────────────────────────────────────────────────────────────
  describe("deleteRunSession", () => {
    it("returns error when run not found", async () => {
      await expect(runsService.deleteRunSession("nonexistent")).rejects.toThrow("Run not found");
    });

    it("returns success when provider not found", async () => {
      createRun(db, { id: "r1" });
      vi.spyOn(
        await import("../providers/providers.repo").then(m => m.providersRepo),
        "findById"
      ).mockResolvedValueOnce(null);

      await runsService.deleteRunSession("r1");
    });

    it("calls adapter.deleteSession when available", async () => {
      createRun(db, { id: "r1" });
      const mockAdapter = {
        deleteSession: vi.fn(),
      };
      vi.mocked(createWorkAdapter).mockReturnValue(mockAdapter as any);

      await runsService.deleteRunSession("r1");
      expect(mockAdapter.deleteSession).toHaveBeenCalledWith("r1");
    });

    it("succeeds when adapter has no deleteSession", async () => {
      createRun(db, { id: "r1" });
      vi.mocked(createWorkAdapter).mockReturnValue({} as any);

      await runsService.deleteRunSession("r1");
    });

    it("returns error on outer catch", async () => {
      vi.spyOn(runsRepo, "findRunById").mockRejectedValueOnce(new Error("db error"));
      await expect(runsService.deleteRunSession("r1")).rejects.toThrow("db error");
    });

    it("returns error when adapter.deleteSession throws", async () => {
      createRun(db, { id: "r1" });
      vi.mocked(createWorkAdapter).mockReturnValue({
        deleteSession: vi.fn().mockRejectedValue(new Error("delete failed")),
      } as any);

      await expect(runsService.deleteRunSession("r1")).rejects.toThrow("delete failed");
    });
  });
});
