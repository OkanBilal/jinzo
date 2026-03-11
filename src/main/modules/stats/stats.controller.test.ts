import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createProvider,
  createRun,
  createWorkspace,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({ getDb: () => db }));

// Import after mock
const { statsController } = await import("./stats.controller");

describe("statsController", () => {
  beforeEach(() => {
    const result = createTestDb();
    db = result.db;
    _sqlite = result.sqlite;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  // ── getDashboard ────────────────────────────────────────────
  describe("getDashboard", () => {
    it("returns success with dashboard data when no data exists", async () => {
      const res = await statsController.getDashboard();
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data!.summary).toBeDefined();
      expect(res.data!.dailyActivity).toBeDefined();
      expect(res.data!.hourDistribution).toBeDefined();
      expect(res.data!.costByModel).toBeDefined();
      expect(res.data!.toolUsage).toBeDefined();
      expect(res.data!.statusBreakdown).toBeDefined();
      expect(res.data!.recentSessions).toBeDefined();
      expect(res.data!.codeActivity).toBeDefined();
    });

    it("returns dashboard data with runs present", async () => {
      createAccount(db, { id: "default" });
      createProvider(db, { id: "copilot_cli" });
      createProvider(db, { id: "claude_code", displayName: "Claude Code" });
      createWorkspace(db, { id: "ws-1", name: "Test WS" });
      createRun(db, { id: "run-1", providerId: "copilot_cli" });
      createRun(db, { id: "run-2", providerId: "claude_code" });

      const res = await statsController.getDashboard();
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data!.summary.totalSessions).toBeGreaterThanOrEqual(2);
    });

    it("filters by provider when given copilot_cli filter", async () => {
      createAccount(db, { id: "default" });
      createProvider(db, { id: "copilot_cli" });
      createProvider(db, { id: "claude_code", displayName: "Claude Code" });
      createRun(db, { id: "run-1", providerId: "copilot_cli" });
      createRun(db, { id: "run-2", providerId: "claude_code" });

      const res = await statsController.getDashboard("copilot_cli");
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });

    it("filters by provider when given claude_code filter", async () => {
      createAccount(db, { id: "default" });
      createProvider(db, { id: "copilot_cli" });
      createProvider(db, { id: "claude_code", displayName: "Claude Code" });
      createRun(db, { id: "run-1", providerId: "copilot_cli" });
      createRun(db, { id: "run-2", providerId: "claude_code" });

      const res = await statsController.getDashboard("claude_code");
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });

    it("defaults to 'all' filter when no filter provided", async () => {
      createAccount(db, { id: "default" });
      createProvider(db, { id: "copilot_cli" });
      createRun(db, { id: "run-1", providerId: "copilot_cli" });

      const resAll = await statsController.getDashboard();
      const resExplicit = await statsController.getDashboard("all");

      expect(resAll.success).toBe(true);
      expect(resExplicit.success).toBe(true);
      // Both should return the same summary
      expect(resAll.data!.summary.totalSessions).toBe(resExplicit.data!.summary.totalSessions);
    });

    it("wraps service errors in { success: false }", async () => {
      // Force an error by closing the db
      cleanup();

      const res = await statsController.getDashboard();
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
