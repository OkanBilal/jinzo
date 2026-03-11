import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createSpace } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { appSettingsService } from "./appSettings.service";

describe("appSettingsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("ensureSettings", () => {
    it("creates default settings if none exist", async () => {
      const result = await appSettingsService.ensureSettings();
      expect(result.id).toBe("default");
      expect(result.accountId).toBe("default");
    });

    it("returns existing settings without creating new ones", async () => {
      const first = await appSettingsService.ensureSettings();
      const second = await appSettingsService.ensureSettings();
      expect(first.id).toBe(second.id);
    });
  });

  describe("getSettings", () => {
    it("returns settings with success", async () => {
      const result = await appSettingsService.getSettings();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("default");
      }
    });
  });

  describe("setActiveSpace", () => {
    it("sets active space to a valid space id", async () => {
      const space = createSpace(db, { accountId: "default" });

      const result = await appSettingsService.setActiveSpace(space.id);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeSpaceId).toBe(space.id);
      }
    });

    it("clears active space with null", async () => {
      const result = await appSettingsService.setActiveSpace(null);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeSpaceId).toBeNull();
      }
    });

    it("rejects non-string space id", async () => {
      const result = await appSettingsService.setActiveSpace(42);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("spaceId must be a string or null");
      }
    });
  });

  describe("setEnableWorktrees", () => {
    it("sets to false", async () => {
      const result = await appSettingsService.setEnableWorktrees(false);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableWorktrees).toBe(false);
      }
    });

    it("rejects non-boolean", async () => {
      const result = await appSettingsService.setEnableWorktrees("yes");
      expect(result.success).toBe(false);
    });
  });

  describe("setShowToolCalls", () => {
    it("sets to false", async () => {
      const result = await appSettingsService.setShowToolCalls(false);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.showToolCalls).toBe(false);
      }
    });

    it("rejects non-boolean", async () => {
      const result = await appSettingsService.setShowToolCalls(123);
      expect(result.success).toBe(false);
    });
  });

  describe("setPreventSleepDuringRuns", () => {
    it("enables setting", async () => {
      const result = await appSettingsService.setPreventSleepDuringRuns(true);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preventSleepDuringRuns).toBe(true);
      }
    });
  });

  describe("setNotifyOnRunComplete", () => {
    it("disables setting", async () => {
      const result = await appSettingsService.setNotifyOnRunComplete(false);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notifyOnRunComplete).toBe(false);
      }
    });
  });

  describe("setNotifyOnToolApproval", () => {
    it("disables setting", async () => {
      const result = await appSettingsService.setNotifyOnToolApproval(false);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notifyOnToolApproval).toBe(false);
      }
    });
  });

  describe("setCommitInstructions", () => {
    it("sets instructions", async () => {
      const result = await appSettingsService.setCommitInstructions("Use conventional commits");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.commitInstructions).toBe("Use conventional commits");
      }
    });

    it("rejects non-string", async () => {
      const result = await appSettingsService.setCommitInstructions(42);
      expect(result.success).toBe(false);
    });
  });

  describe("setPrInstructions", () => {
    it("sets instructions", async () => {
      const result = await appSettingsService.setPrInstructions("Include ticket number");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prInstructions).toBe("Include ticket number");
      }
    });

    it("rejects non-string", async () => {
      const result = await appSettingsService.setPrInstructions(null);
      expect(result.success).toBe(false);
    });
  });
});
