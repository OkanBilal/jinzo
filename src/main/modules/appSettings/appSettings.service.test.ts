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

  // ─────────────────────────────────────────────────────────────
  // Coverage: ensureSettings - created is null after insert
  // ─────────────────────────────────────────────────────────────
  describe("ensureSettings - creation failure", () => {
    it("throws when created settings cannot be found after insert", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalFindById = appSettingsRepo.findById;

      let callCount = 0;
      appSettingsRepo.findById = async (id: string) => {
        callCount++;
        // First call returns null (no existing), second call returns null (creation failed)
        if (callCount <= 2) return null;
        return originalFindById.call(appSettingsRepo, id);
      };

      await expect(appSettingsService.ensureSettings()).rejects.toThrow("Failed to create app settings");

      appSettingsRepo.findById = originalFindById;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: getSettings - catch block
  // ─────────────────────────────────────────────────────────────
  describe("getSettings - error handling", () => {
    it("returns error message when ensureSettings throws an Error", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalFindById = appSettingsRepo.findById;
      appSettingsRepo.findById = async () => {
        throw new Error("db connection lost");
      };

      const result = await appSettingsService.getSettings();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("db connection lost");
      }

      appSettingsRepo.findById = originalFindById;
    });

    it("returns 'Unknown error' when ensureSettings throws a non-Error", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalFindById = appSettingsRepo.findById;
      appSettingsRepo.findById = async () => {
        throw "string error";
      };

      const result = await appSettingsService.getSettings();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.findById = originalFindById;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: setActiveSpace - update returns null + catch blocks
  // ─────────────────────────────────────────────────────────────
  describe("setActiveSpace - error handling", () => {
    it("returns failure when updateActiveSpace returns null", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateActiveSpace;
      appSettingsRepo.updateActiveSpace = async () => null;

      const result = await appSettingsService.setActiveSpace("some-id");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update settings");
      }

      appSettingsRepo.updateActiveSpace = originalUpdate;
    });

    it("catches Error thrown during setActiveSpace", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateActiveSpace;
      appSettingsRepo.updateActiveSpace = async () => {
        throw new Error("update failed");
      };

      const result = await appSettingsService.setActiveSpace("some-id");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("update failed");
      }

      appSettingsRepo.updateActiveSpace = originalUpdate;
    });

    it("catches non-Error thrown during setActiveSpace", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateActiveSpace;
      appSettingsRepo.updateActiveSpace = async () => {
        throw 42;
      };

      const result = await appSettingsService.setActiveSpace("some-id");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.updateActiveSpace = originalUpdate;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: setEnableWorktrees - update returns null + catch blocks
  // ─────────────────────────────────────────────────────────────
  describe("setEnableWorktrees - error handling", () => {
    it("returns failure when updateEnableWorktrees returns null", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateEnableWorktrees;
      appSettingsRepo.updateEnableWorktrees = async () => null;

      const result = await appSettingsService.setEnableWorktrees(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update settings");
      }

      appSettingsRepo.updateEnableWorktrees = originalUpdate;
    });

    it("catches Error thrown during setEnableWorktrees", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateEnableWorktrees;
      appSettingsRepo.updateEnableWorktrees = async () => {
        throw new Error("worktree error");
      };

      const result = await appSettingsService.setEnableWorktrees(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("worktree error");
      }

      appSettingsRepo.updateEnableWorktrees = originalUpdate;
    });

    it("catches non-Error thrown during setEnableWorktrees", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateEnableWorktrees;
      appSettingsRepo.updateEnableWorktrees = async () => {
        throw null;
      };

      const result = await appSettingsService.setEnableWorktrees(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.updateEnableWorktrees = originalUpdate;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: setShowToolCalls - update returns null + catch blocks
  // ─────────────────────────────────────────────────────────────
  describe("setShowToolCalls - error handling", () => {
    it("returns failure when updateShowToolCalls returns null", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateShowToolCalls;
      appSettingsRepo.updateShowToolCalls = async () => null;

      const result = await appSettingsService.setShowToolCalls(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update settings");
      }

      appSettingsRepo.updateShowToolCalls = originalUpdate;
    });

    it("catches Error thrown during setShowToolCalls", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateShowToolCalls;
      appSettingsRepo.updateShowToolCalls = async () => {
        throw new Error("tool calls error");
      };

      const result = await appSettingsService.setShowToolCalls(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("tool calls error");
      }

      appSettingsRepo.updateShowToolCalls = originalUpdate;
    });

    it("catches non-Error thrown during setShowToolCalls", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateShowToolCalls;
      appSettingsRepo.updateShowToolCalls = async () => {
        throw undefined;
      };

      const result = await appSettingsService.setShowToolCalls(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.updateShowToolCalls = originalUpdate;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: setPreventSleepDuringRuns - update returns null + catch blocks
  // ─────────────────────────────────────────────────────────────
  describe("setPreventSleepDuringRuns - error handling", () => {
    it("rejects non-boolean", async () => {
      const result = await appSettingsService.setPreventSleepDuringRuns("yes");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("enabled must be a boolean");
      }
    });

    it("returns failure when updatePreventSleepDuringRuns returns null", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updatePreventSleepDuringRuns;
      appSettingsRepo.updatePreventSleepDuringRuns = async () => null;

      const result = await appSettingsService.setPreventSleepDuringRuns(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update settings");
      }

      appSettingsRepo.updatePreventSleepDuringRuns = originalUpdate;
    });

    it("catches Error thrown during setPreventSleepDuringRuns", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updatePreventSleepDuringRuns;
      appSettingsRepo.updatePreventSleepDuringRuns = async () => {
        throw new Error("sleep error");
      };

      const result = await appSettingsService.setPreventSleepDuringRuns(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("sleep error");
      }

      appSettingsRepo.updatePreventSleepDuringRuns = originalUpdate;
    });

    it("catches non-Error thrown during setPreventSleepDuringRuns", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updatePreventSleepDuringRuns;
      appSettingsRepo.updatePreventSleepDuringRuns = async () => {
        throw 0;
      };

      const result = await appSettingsService.setPreventSleepDuringRuns(false);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.updatePreventSleepDuringRuns = originalUpdate;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: setNotifyOnRunComplete - update returns null + catch blocks
  // ─────────────────────────────────────────────────────────────
  describe("setNotifyOnRunComplete - error handling", () => {
    it("rejects non-boolean", async () => {
      const result = await appSettingsService.setNotifyOnRunComplete(1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("enabled must be a boolean");
      }
    });

    it("returns failure when updateNotifyOnRunComplete returns null", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateNotifyOnRunComplete;
      appSettingsRepo.updateNotifyOnRunComplete = async () => null;

      const result = await appSettingsService.setNotifyOnRunComplete(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update settings");
      }

      appSettingsRepo.updateNotifyOnRunComplete = originalUpdate;
    });

    it("catches Error thrown during setNotifyOnRunComplete", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateNotifyOnRunComplete;
      appSettingsRepo.updateNotifyOnRunComplete = async () => {
        throw new Error("notify error");
      };

      const result = await appSettingsService.setNotifyOnRunComplete(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("notify error");
      }

      appSettingsRepo.updateNotifyOnRunComplete = originalUpdate;
    });

    it("catches non-Error thrown during setNotifyOnRunComplete", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateNotifyOnRunComplete;
      appSettingsRepo.updateNotifyOnRunComplete = async () => {
        throw { code: 500 };
      };

      const result = await appSettingsService.setNotifyOnRunComplete(false);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.updateNotifyOnRunComplete = originalUpdate;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: setNotifyOnToolApproval - update returns null + catch blocks
  // ─────────────────────────────────────────────────────────────
  describe("setNotifyOnToolApproval - error handling", () => {
    it("rejects non-boolean", async () => {
      const result = await appSettingsService.setNotifyOnToolApproval("no");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("enabled must be a boolean");
      }
    });

    it("returns failure when updateNotifyOnToolApproval returns null", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateNotifyOnToolApproval;
      appSettingsRepo.updateNotifyOnToolApproval = async () => null;

      const result = await appSettingsService.setNotifyOnToolApproval(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update settings");
      }

      appSettingsRepo.updateNotifyOnToolApproval = originalUpdate;
    });

    it("catches Error thrown during setNotifyOnToolApproval", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateNotifyOnToolApproval;
      appSettingsRepo.updateNotifyOnToolApproval = async () => {
        throw new Error("approval error");
      };

      const result = await appSettingsService.setNotifyOnToolApproval(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("approval error");
      }

      appSettingsRepo.updateNotifyOnToolApproval = originalUpdate;
    });

    it("catches non-Error thrown during setNotifyOnToolApproval", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateNotifyOnToolApproval;
      appSettingsRepo.updateNotifyOnToolApproval = async () => {
        throw false;
      };

      const result = await appSettingsService.setNotifyOnToolApproval(true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.updateNotifyOnToolApproval = originalUpdate;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: setCommitInstructions - update returns null + catch blocks
  // ─────────────────────────────────────────────────────────────
  describe("setCommitInstructions - error handling", () => {
    it("returns failure when updateCommitInstructions returns null", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateCommitInstructions;
      appSettingsRepo.updateCommitInstructions = async () => null;

      const result = await appSettingsService.setCommitInstructions("test");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update settings");
      }

      appSettingsRepo.updateCommitInstructions = originalUpdate;
    });

    it("catches Error thrown during setCommitInstructions", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateCommitInstructions;
      appSettingsRepo.updateCommitInstructions = async () => {
        throw new Error("commit error");
      };

      const result = await appSettingsService.setCommitInstructions("test");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("commit error");
      }

      appSettingsRepo.updateCommitInstructions = originalUpdate;
    });

    it("catches non-Error thrown during setCommitInstructions", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updateCommitInstructions;
      appSettingsRepo.updateCommitInstructions = async () => {
        throw ["array", "error"];
      };

      const result = await appSettingsService.setCommitInstructions("test");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.updateCommitInstructions = originalUpdate;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Coverage: setPrInstructions - update returns null + catch blocks
  // ─────────────────────────────────────────────────────────────
  describe("setPrInstructions - error handling", () => {
    it("returns failure when updatePrInstructions returns null", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updatePrInstructions;
      appSettingsRepo.updatePrInstructions = async () => null;

      const result = await appSettingsService.setPrInstructions("test");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update settings");
      }

      appSettingsRepo.updatePrInstructions = originalUpdate;
    });

    it("catches Error thrown during setPrInstructions", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updatePrInstructions;
      appSettingsRepo.updatePrInstructions = async () => {
        throw new Error("pr error");
      };

      const result = await appSettingsService.setPrInstructions("test");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("pr error");
      }

      appSettingsRepo.updatePrInstructions = originalUpdate;
    });

    it("catches non-Error thrown during setPrInstructions", async () => {
      const { appSettingsRepo } = await import("./appSettings.repo");
      const originalUpdate = appSettingsRepo.updatePrInstructions;
      appSettingsRepo.updatePrInstructions = async () => {
        throw 999;
      };

      const result = await appSettingsService.setPrInstructions("test");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }

      appSettingsRepo.updatePrInstructions = originalUpdate;
    });
  });
});
