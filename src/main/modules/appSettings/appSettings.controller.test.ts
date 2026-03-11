import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createAppSettings, createSpace } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { appSettingsController } from "./appSettings.controller";

describe("appSettingsController", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createAppSettings(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("get", () => {
    it("returns the default app settings", async () => {
      const result = await appSettingsController.get();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("default");
      }
    });
  });

  describe("setActiveSpace", () => {
    it("sets the active space to a valid space id", async () => {
      const space = createSpace(db, {});
      const result = await appSettingsController.setActiveSpace(space.id);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeSpaceId).toBe(space.id);
      }
    });

    it("sets the active space to null", async () => {
      const result = await appSettingsController.setActiveSpace(null);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeSpaceId).toBeNull();
      }
    });

    it("returns error for invalid input", async () => {
      const result = await appSettingsController.setActiveSpace(123);
      expect(result.success).toBe(false);
    });
  });

  describe("setEnableWorktrees", () => {
    it("enables worktrees", async () => {
      const result = await appSettingsController.setEnableWorktrees(true);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableWorktrees).toBe(true);
      }
    });

    it("disables worktrees", async () => {
      const result = await appSettingsController.setEnableWorktrees(false);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableWorktrees).toBe(false);
      }
    });

    it("returns error for invalid input", async () => {
      const result = await appSettingsController.setEnableWorktrees("not-a-boolean");
      expect(result.success).toBe(false);
    });
  });

  describe("setShowToolCalls", () => {
    it("sets showToolCalls", async () => {
      const result = await appSettingsController.setShowToolCalls(true);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.showToolCalls).toBe(true);
      }
    });

    it("returns error for invalid input", async () => {
      const result = await appSettingsController.setShowToolCalls("invalid");
      expect(result.success).toBe(false);
    });
  });

  describe("setPreventSleepDuringRuns", () => {
    it("sets preventSleepDuringRuns", async () => {
      const result = await appSettingsController.setPreventSleepDuringRuns(true);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preventSleepDuringRuns).toBe(true);
      }
    });

    it("returns error for invalid input", async () => {
      const result = await appSettingsController.setPreventSleepDuringRuns(42);
      expect(result.success).toBe(false);
    });
  });

  describe("setNotifyOnRunComplete", () => {
    it("sets notifyOnRunComplete", async () => {
      const result = await appSettingsController.setNotifyOnRunComplete(true);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notifyOnRunComplete).toBe(true);
      }
    });

    it("returns error for invalid input", async () => {
      const result = await appSettingsController.setNotifyOnRunComplete(null);
      expect(result.success).toBe(false);
    });
  });

  describe("setNotifyOnToolApproval", () => {
    it("sets notifyOnToolApproval", async () => {
      const result = await appSettingsController.setNotifyOnToolApproval(false);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notifyOnToolApproval).toBe(false);
      }
    });

    it("returns error for invalid input", async () => {
      const result = await appSettingsController.setNotifyOnToolApproval({});
      expect(result.success).toBe(false);
    });
  });

  describe("setCommitInstructions", () => {
    it("sets commit instructions", async () => {
      const result = await appSettingsController.setCommitInstructions("Use conventional commits");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.commitInstructions).toBe("Use conventional commits");
      }
    });

    it("clears commit instructions with empty string", async () => {
      const result = await appSettingsController.setCommitInstructions("");
      expect(result.success).toBe(true);
    });

    it("returns error for invalid input", async () => {
      const result = await appSettingsController.setCommitInstructions(123);
      expect(result.success).toBe(false);
    });
  });

  describe("setPrInstructions", () => {
    it("sets PR instructions", async () => {
      const result = await appSettingsController.setPrInstructions("Include test plan");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prInstructions).toBe("Include test plan");
      }
    });

    it("returns error for invalid input", async () => {
      const result = await appSettingsController.setPrInstructions(false);
      expect(result.success).toBe(false);
    });
  });
});
