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

import { appSettingsRepo } from "./appSettings.repo";

describe("appSettingsRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("findById", () => {
    it("returns null when not found", async () => {
      const result = await appSettingsRepo.findById("nonexistent");
      expect(result).toBeNull();
    });

    it("returns settings when found", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.findById("default");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("default");
    });
  });

  describe("createDefaultAccount", () => {
    it("creates the default account if it does not exist", async () => {
      await appSettingsRepo.createDefaultAccount();

      const settings = createAppSettings(db, { id: "default", accountId: "default" });
      expect(settings.accountId).toBe("default");
    });

    it("does not fail if the default account already exists", async () => {
      createAccount(db, { id: "default" });
      await expect(appSettingsRepo.createDefaultAccount()).resolves.not.toThrow();
    });
  });

  describe("create", () => {
    it("inserts a new settings row", async () => {
      createAccount(db, { id: "default" });
      await appSettingsRepo.create({ id: "s1", accountId: "default" });

      const result = await appSettingsRepo.findById("s1");
      expect(result).not.toBeNull();
      expect(result!.accountId).toBe("default");
    });

    it("does nothing on conflict", async () => {
      createAppSettings(db, { id: "s1" });
      await expect(
        appSettingsRepo.create({ id: "s1", accountId: "default" }),
      ).resolves.not.toThrow();
    });
  });

  describe("updateActiveSpace", () => {
    it("sets activeSpaceId and returns updated row", async () => {
      createAppSettings(db, { id: "default" });
      const space = createSpace(db, { accountId: "default" });

      const result = await appSettingsRepo.updateActiveSpace("default", space.id);
      expect(result).not.toBeNull();
      expect(result!.activeSpaceId).toBe(space.id);
    });

    it("clears activeSpaceId when set to null", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.updateActiveSpace("default", null);
      expect(result).not.toBeNull();
      expect(result!.activeSpaceId).toBeNull();
    });
  });

  describe("updateEnableWorktrees", () => {
    it("toggles enableWorktrees", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.updateEnableWorktrees("default", false);
      expect(result).not.toBeNull();
      expect(result!.enableWorktrees).toBe(false);
    });
  });

  describe("updateShowToolCalls", () => {
    it("toggles showToolCalls", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.updateShowToolCalls("default", false);
      expect(result!.showToolCalls).toBe(false);
    });
  });

  describe("updatePreventSleepDuringRuns", () => {
    it("toggles preventSleepDuringRuns", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.updatePreventSleepDuringRuns("default", true);
      expect(result!.preventSleepDuringRuns).toBe(true);
    });
  });

  describe("updateNotifyOnRunComplete", () => {
    it("toggles notifyOnRunComplete", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.updateNotifyOnRunComplete("default", false);
      expect(result!.notifyOnRunComplete).toBe(false);
    });
  });

  describe("updateNotifyOnToolApproval", () => {
    it("toggles notifyOnToolApproval", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.updateNotifyOnToolApproval("default", false);
      expect(result!.notifyOnToolApproval).toBe(false);
    });
  });

  describe("updateCommitInstructions", () => {
    it("sets commit instructions text", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.updateCommitInstructions(
        "default",
        "Use conventional commits",
      );
      expect(result!.commitInstructions).toBe("Use conventional commits");
    });
  });

  describe("updatePrInstructions", () => {
    it("sets PR instructions text", async () => {
      createAppSettings(db, { id: "default" });

      const result = await appSettingsRepo.updatePrInstructions(
        "default",
        "Include ticket number",
      );
      expect(result!.prInstructions).toBe("Include ticket number");
    });
  });
});
