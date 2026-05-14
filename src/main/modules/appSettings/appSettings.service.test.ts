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
import { appSettingsRepo } from "./appSettings.repo";

describe("appSettingsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("ensureSettings", () => {
    it("creates the default row lazily on first access", async () => {
      const result = await appSettingsService.ensureSettings();
      expect(result.id).toBe("default");
      expect(result.accountId).toBe("default");
    });

    it("is idempotent", async () => {
      const first = await appSettingsService.ensureSettings();
      const second = await appSettingsService.ensureSettings();
      expect(first.id).toBe(second.id);
      expect(first.createdAt).toEqual(second.createdAt);
    });

    it("throws when the row cannot be read after insert", async () => {
      const original = appSettingsRepo.findById;
      appSettingsRepo.findById = async () => null;
      try {
        await expect(appSettingsService.ensureSettings()).rejects.toThrow(
          "Failed to create app settings",
        );
      } finally {
        appSettingsRepo.findById = original;
      }
    });
  });

  describe("getSettings", () => {
    it("returns the default row", async () => {
      const result = await appSettingsService.getSettings();
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe("default");
    });

    it("returns the Error message when ensureSettings throws an Error", async () => {
      const original = appSettingsRepo.findById;
      appSettingsRepo.findById = async () => {
        throw new Error("db connection lost");
      };
      try {
        const result = await appSettingsService.getSettings();
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe("db connection lost");
      } finally {
        appSettingsRepo.findById = original;
      }
    });

    it("returns 'Unknown error' when ensureSettings throws a non-Error", async () => {
      const original = appSettingsRepo.findById;
      appSettingsRepo.findById = async () => {
        throw "string error";
      };
      try {
        const result = await appSettingsService.getSettings();
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe("Unknown error");
      } finally {
        appSettingsRepo.findById = original;
      }
    });
  });

  describe("updateSettings", () => {
    it("applies a single-field patch and returns the latest row", async () => {
      const result = await appSettingsService.updateSettings({
        enableWorktrees: false,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.enableWorktrees).toBe(false);
    });

    it("applies a multi-field patch atomically", async () => {
      const result = await appSettingsService.updateSettings({
        showToolCalls: false,
        notifyOnRunComplete: false,
        commitInstructions: "Use conventional commits",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.showToolCalls).toBe(false);
        expect(result.data.notifyOnRunComplete).toBe(false);
        expect(result.data.commitInstructions).toBe("Use conventional commits");
      }
    });

    it("accepts a valid spaceId for activeSpaceId", async () => {
      const space = createSpace(db, { accountId: "default" });
      const result = await appSettingsService.updateSettings({
        activeSpaceId: space.id,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.activeSpaceId).toBe(space.id);
    });

    it("accepts null for activeSpaceId", async () => {
      const result = await appSettingsService.updateSettings({
        activeSpaceId: null,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.activeSpaceId).toBeNull();
    });

    it("strips unknown keys silently", async () => {
      const result = await appSettingsService.updateSettings({
        enableWorktrees: false,
        somethingMadeUp: "ignored",
      } as unknown);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableWorktrees).toBe(false);
        expect((result.data as unknown as Record<string, unknown>).somethingMadeUp).toBeUndefined();
      }
    });

    it("strips immutable fields (id, accountId, createdAt, updatedAt)", async () => {
      const before = await appSettingsService.ensureSettings();
      const result = await appSettingsService.updateSettings({
        id: "hacked",
        accountId: "hacked",
        createdAt: 0,
        updatedAt: 0,
        enableWorktrees: false,
      } as unknown);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("default");
        expect(result.data.accountId).toBe("default");
        expect(result.data.createdAt).toEqual(before.createdAt);
        expect(result.data.enableWorktrees).toBe(false);
      }
    });

    it("rejects non-object patches", async () => {
      for (const bad of [null, undefined, "string", 42, true]) {
        const result = await appSettingsService.updateSettings(bad);
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe("patch must be an object");
      }
    });

    it("returns failure when repo.update returns null", async () => {
      const original = appSettingsRepo.update;
      appSettingsRepo.update = async () => null;
      try {
        const result = await appSettingsService.updateSettings({
          enableWorktrees: true,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe("Failed to update settings");
      } finally {
        appSettingsRepo.update = original;
      }
    });

    it("returns the Error message when repo.update throws an Error", async () => {
      const original = appSettingsRepo.update;
      appSettingsRepo.update = async () => {
        throw new Error("update failed");
      };
      try {
        const result = await appSettingsService.updateSettings({
          enableWorktrees: true,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe("update failed");
      } finally {
        appSettingsRepo.update = original;
      }
    });

    it("returns 'Unknown error' when repo.update throws a non-Error", async () => {
      const original = appSettingsRepo.update;
      appSettingsRepo.update = async () => {
        throw 42;
      };
      try {
        const result = await appSettingsService.updateSettings({
          enableWorktrees: true,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe("Unknown error");
      } finally {
        appSettingsRepo.update = original;
      }
    });
  });
});
