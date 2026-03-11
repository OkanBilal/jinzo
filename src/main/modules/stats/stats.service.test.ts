import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createProvider } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { statsService } from "./stats.service";

describe("statsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createProvider(db, { id: "claude_code", kind: "agent_runtime", displayName: "Claude Code" });
    createProvider(db, { id: "copilot_cli", kind: "agent_runtime", displayName: "Copilot CLI" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("getDashboard", () => {
    it("returns full dashboard with empty data", async () => {
      const result = await statsService.getDashboard();

      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("dailyActivity");
      expect(result).toHaveProperty("hourDistribution");
      expect(result).toHaveProperty("costByModel");
      expect(result).toHaveProperty("toolUsage");
      expect(result).toHaveProperty("statusBreakdown");
      expect(result).toHaveProperty("recentSessions");
      expect(result).toHaveProperty("codeActivity");

      expect(result.summary.totalProjects).toBe(0);
      expect(result.summary.totalSessions).toBe(0);
      expect(result.dailyActivity).toEqual([]);
      expect(result.hourDistribution).toEqual([]);
      expect(result.costByModel).toEqual([]);
      expect(result.toolUsage).toEqual([]);
      expect(result.recentSessions).toEqual([]);
      expect(result.codeActivity.totalDiffs).toBe(0);
    });

    it("accepts a provider filter", async () => {
      const result = await statsService.getDashboard("claude_code");
      expect(result.summary).toBeDefined();
    });
  });
});
