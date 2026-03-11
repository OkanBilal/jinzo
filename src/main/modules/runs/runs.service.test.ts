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

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

// Mock electron (powerSaveBlocker, Notification, BrowserWindow)
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
    getPath: (name: string) => `/tmp/jinzo-test/${name}`,
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s, "utf-8"),
    decryptString: (b: Buffer) => b.toString("utf-8"),
  },
}));

// Mock adapters (not testing executeRun orchestration here)
vi.mock("../providers/adapters", () => ({
  createWorkAdapter: vi.fn(),
}));

// Mock git service
vi.mock("../git/git.service", () => ({
  gitService: {
    getHeadSha: vi.fn(),
    getDiffSince: vi.fn(),
    getChangedFilesSince: vi.fn(),
    getShortStatSince: vi.fn(),
    getUntrackedFiles: vi.fn(),
  },
}));

// Mock workspace diffs service
vi.mock("../workspaceDiffs/workspaceDiffs.service", () => ({
  workspaceDiffsService: {
    createDiff: vi.fn().mockResolvedValue({ success: true, data: "diff-id" }),
  },
}));

// Mock workspace activity service
vi.mock("../workspaceActivity/workspaceActivity.service", () => ({
  workspaceActivityService: {
    log: vi.fn(),
  },
}));

import { runsService } from "./runs.service";

describe("runsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createProvider(db, { id: "copilot_cli" });
  });

  afterEach(() => {
    cleanup();
  });

  // ─────────────────────────────────────────────────────────────
  // Run Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAllRuns", () => {
    it("returns empty array when no runs", async () => {
      const result = await runsService.getAllRuns();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns all runs", async () => {
      createRun(db, { id: "r1" });
      createRun(db, { id: "r2" });

      const result = await runsService.getAllRuns();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      createRun(db, { id: "r1" });
      createRun(db, { id: "r2" });
      createRun(db, { id: "r3" });

      const result = await runsService.getAllRuns(2);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getRunById", () => {
    it("returns run when found", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getRunById("r1");
      expect(result.success).toBe(true);
      expect(result.data!.id).toBe("r1");
    });

    it("returns error when not found", async () => {
      const result = await runsService.getRunById("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Run not found");
    });
  });

  describe("getRunsByAccount", () => {
    it("returns runs for account", async () => {
      createRun(db, { id: "r1", accountId: "default" });

      const result = await runsService.getRunsByAccount("default");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty for unknown account", async () => {
      const result = await runsService.getRunsByAccount("unknown");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("getRunsByWorkspace", () => {
    it("returns runs for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", workspaceId: ws.id });

      const result = await runsService.getRunsByWorkspace("ws1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getRunsByStatus", () => {
    it("returns runs filtered by status", async () => {
      createRun(db, { id: "r1", status: "running" });
      createRun(db, { id: "r2", status: "succeeded" });

      const result = await runsService.getRunsByStatus("default", "running");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe("r1");
    });
  });

  describe("createRun", () => {
    it("creates a run and returns id", async () => {
      const result = await runsService.createRun({
        id: "new-run-1",
        accountId: "default",
        providerId: "copilot_cli",
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe("new-run-1");
    });
  });

  describe("updateRun", () => {
    it("updates an existing run", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.updateRun("r1", { status: "running" });
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe("running");
    });

    it("returns error for nonexistent run", async () => {
      const result = await runsService.updateRun("nonexistent", { status: "running" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Run not found");
    });
  });

  describe("startRun", () => {
    it("sets status to running", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsService.startRun("r1");
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe("running");
    });
  });

  describe("completeRun", () => {
    it("sets status to succeeded", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.completeRun("r1");
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe("succeeded");
    });
  });

  describe("failRun", () => {
    it("sets status to failed with error", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.failRun("r1", "something broke");
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe("failed");
      expect(result.data!.lastError).toBe("something broke");
    });
  });

  describe("cancelRun", () => {
    it("sets status to canceled", async () => {
      createRun(db, { id: "r1", status: "running" });

      const result = await runsService.cancelRun("r1");
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe("canceled");
    });
  });

  describe("deleteRun", () => {
    it("deletes an existing run", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.deleteRun("r1");
      expect(result.success).toBe(true);

      const check = await runsService.getRunById("r1");
      expect(check.success).toBe(false);
    });
  });

  describe("archiveRun", () => {
    it("archives an existing run", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.archiveRun("r1");
      expect(result.success).toBe(true);
      expect(result.data!.isArchived).toBe(true);
    });

    it("returns error for nonexistent run", async () => {
      const result = await runsService.archiveRun("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Run not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Context Operations
  // ─────────────────────────────────────────────────────────────
  describe("getContextByRun", () => {
    it("returns empty array when no context", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getContextByRun("r1");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns context items", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });

      const result = await runsService.getContextByRun("r1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
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
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe("number");
    });
  });

  describe("removeContext", () => {
    it("removes context", async () => {
      createRun(db, { id: "r1" });
      const ctx = createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });

      const result = await runsService.removeContext(ctx.id);
      expect(result.success).toBe(true);

      const check = await runsService.getContextByRun("r1");
      expect(check.data).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Artifact Operations
  // ─────────────────────────────────────────────────────────────
  describe("getArtifactsByRun", () => {
    it("returns empty array when no artifacts", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getArtifactsByRun("r1");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns artifacts", async () => {
      createRun(db, { id: "r1" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "hello" });

      const result = await runsService.getArtifactsByRun("r1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
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
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe("number");
    });
  });

  describe("removeArtifact", () => {
    it("removes artifact", async () => {
      createRun(db, { id: "r1" });
      const art = createRunArtifact(db, { runId: "r1", kind: "file", content: "hello" });

      const result = await runsService.removeArtifact(art.id);
      expect(result.success).toBe(true);

      const check = await runsService.getArtifactsByRun("r1");
      expect(check.data).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tool Call Operations
  // ─────────────────────────────────────────────────────────────
  describe("getToolCallsByRun", () => {
    it("returns empty array when no tool calls", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getToolCallsByRun("r1");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns tool calls", async () => {
      createRun(db, { id: "r1" });
      createToolCall(db, { runId: "r1", toolName: "read_file" });

      const result = await runsService.getToolCallsByRun("r1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
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
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe("number");
    });
  });

  describe("updateToolCall", () => {
    it("updates a tool call", async () => {
      createRun(db, { id: "r1" });
      const tc = createToolCall(db, { runId: "r1", toolName: "read_file" });

      const result = await runsService.updateToolCall(tc.id, { status: "done" });
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Details
  // ─────────────────────────────────────────────────────────────
  describe("getRunDetails", () => {
    it("returns error for nonexistent run", async () => {
      const result = await runsService.getRunDetails("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Run not found");
    });

    it("returns run with all related data", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "output" });
      createToolCall(db, { runId: "r1", toolName: "read" });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });

      const result = await runsService.getRunDetails("r1");
      expect(result.success).toBe(true);
      expect(result.data!.run.id).toBe("r1");
      expect(result.data!.context).toHaveLength(1);
      expect(result.data!.artifacts).toHaveLength(1);
      expect(result.data!.toolCalls).toHaveLength(1);
      expect(result.data!.turns).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Turns
  // ─────────────────────────────────────────────────────────────
  describe("getTurnsByRun", () => {
    it("returns empty array when no turns", async () => {
      createRun(db, { id: "r1" });

      const result = await runsService.getTurnsByRun("r1");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns turns for a run", async () => {
      createRun(db, { id: "r1" });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });
      createRunTurn(db, { runId: "r1", turnIndex: 1 });

      const result = await runsService.getTurnsByRun("r1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });
});
