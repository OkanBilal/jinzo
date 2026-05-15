import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createProvider,
  createRun,
  createWorkspace,
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

vi.mock("../../db/client", () => ({ getDb: () => db }));

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
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
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

vi.mock("../workspaceActivity/workspaceActivity.service", () => ({
  workspaceActivityService: { log: vi.fn() },
}));

import { runsController } from "./runs.controller";

describe("runsController", () => {
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
    it("returns empty array", async () => {
      const result = await runsController.getAllRuns();
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns runs", async () => {
      createRun(db, { id: "r1" });
      createRun(db, { id: "r2" });

      const result = await runsController.getAllRuns();
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("respects limit", async () => {
      createRun(db, { id: "r1" });
      createRun(db, { id: "r2" });
      createRun(db, { id: "r3" });

      const result = await runsController.getAllRuns(2);
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getRunById", () => {
    it("returns run", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.getRunById("r1");
      assertOk(result);
      expect(result.data!.id).toBe("r1");
    });

    it("returns error when not found", async () => {
      const result = await runsController.getRunById("nope");
      assertFail(result);
    });
  });

  describe("getRunsByAccount", () => {
    it("returns runs for account", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.getRunsByAccount("default");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getRunsByWorkspace", () => {
    it("returns runs for workspace", async () => {
      createWorkspace(db, { id: "ws1" });
      createRun(db, { id: "r1", workspaceId: "ws1" });

      const result = await runsController.getRunsByWorkspace("ws1");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getRunsByStatus", () => {
    it("filters by status", async () => {
      createRun(db, { id: "r1", status: "running" });
      createRun(db, { id: "r2", status: "succeeded" });

      const result = await runsController.getRunsByStatus("default", "running");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("createRun", () => {
    it("creates a run", async () => {
      const result = await runsController.createRun({
        id: "new-run",
        accountId: "default",
        providerId: "copilot_cli",
      });
      assertOk(result);
      expect(result.data).toBe("new-run");
    });
  });

  describe("updateRun", () => {
    it("updates a run", async () => {
      createRun(db, { id: "r1", status: "queued" });

      const result = await runsController.updateRun("r1", { status: "running" });
      assertOk(result);
      expect(result.data!.status).toBe("running");
    });
  });

  describe("startRun", () => {
    it("sets status to running", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.startRun("r1");
      assertOk(result);
      expect(result.data!.status).toBe("running");
    });
  });

  describe("completeRun", () => {
    it("sets status to succeeded", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.completeRun("r1");
      assertOk(result);
      expect(result.data!.status).toBe("succeeded");
    });
  });

  describe("failRun", () => {
    it("sets status to failed", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.failRun("r1", "oops");
      assertOk(result);
      expect(result.data!.status).toBe("failed");
    });
  });

  describe("cancelRun", () => {
    it("sets status to canceled", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.cancelRun("r1");
      assertOk(result);
      expect(result.data!.status).toBe("canceled");
    });
  });

  describe("deleteRun", () => {
    it("deletes a run", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.deleteRun("r1");
      assertOk(result);
    });
  });

  describe("archiveRun", () => {
    it("archives a run", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.archiveRun("r1");
      assertOk(result);
      expect(result.data!.isArchived).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Context, Artifacts, Tool Calls
  // ─────────────────────────────────────────────────────────────
  describe("getContextByRun", () => {
    it("returns context", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "test.ts" });

      const result = await runsController.getContextByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("addContext", () => {
    it("adds context", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.addContext({ runId: "r1", kind: "file", content: "f.ts" });
      assertOk(result);
    });
  });

  describe("removeContext", () => {
    it("removes context", async () => {
      createRun(db, { id: "r1" });
      const ctx = createRunContext(db, { runId: "r1", kind: "file", content: "f.ts" });
      const result = await runsController.removeContext(ctx.id);
      assertOk(result);
    });
  });

  describe("getArtifactsByRun", () => {
    it("returns artifacts", async () => {
      createRun(db, { id: "r1" });
      createRunArtifact(db, { runId: "r1", kind: "file", content: "out" });

      const result = await runsController.getArtifactsByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("addArtifact", () => {
    it("adds artifact", async () => {
      createRun(db, { id: "r1" });
      const result = await runsController.addArtifact({ runId: "r1", kind: "file", content: "x" });
      assertOk(result);
    });
  });

  describe("removeArtifact", () => {
    it("removes artifact", async () => {
      createRun(db, { id: "r1" });
      const art = createRunArtifact(db, { runId: "r1", kind: "file", content: "x" });
      const result = await runsController.removeArtifact(art.id);
      assertOk(result);
    });
  });

  describe("getToolCallsByRun", () => {
    it("returns tool calls", async () => {
      createRun(db, { id: "r1" });
      createToolCall(db, { runId: "r1", toolName: "read" });

      const result = await runsController.getToolCallsByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Run Details & Turns
  // ─────────────────────────────────────────────────────────────
  describe("getRunDetails", () => {
    it("returns full run details", async () => {
      createRun(db, { id: "r1" });
      createRunContext(db, { runId: "r1", kind: "file", content: "f" });
      createRunArtifact(db, { runId: "r1", kind: "log", content: "l" });

      const result = await runsController.getRunDetails("r1");
      assertOk(result);
      expect(result.data!.run.id).toBe("r1");
      expect(result.data!.context).toHaveLength(1);
      expect(result.data!.artifacts).toHaveLength(1);
    });

    it("returns error when not found", async () => {
      const result = await runsController.getRunDetails("nope");
      assertFail(result);
    });
  });

  describe("getTurnsByRun", () => {
    it("returns turns", async () => {
      createRun(db, { id: "r1" });
      createRunTurn(db, { runId: "r1", turnIndex: 0 });
      createRunTurn(db, { runId: "r1", turnIndex: 1 });

      const result = await runsController.getTurnsByRun("r1");
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });
  });
});
