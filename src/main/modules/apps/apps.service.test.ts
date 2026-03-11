import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAppState, createConnection } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { appsService } from "./apps.service";
import { appsRepo } from "./apps.repo";

describe("appsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // getAll
  // ─────────────────────────────────────────────────────────────
  describe("getAll", () => {
    it("returns empty list when no apps", async () => {
      const result = await appsService.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns all apps", async () => {
      createAppState(db, { id: "github", displayName: "GitHub" });
      createAppState(db, { id: "linear", displayName: "Linear" });

      const result = await appsService.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it("returns apps with correct fields", async () => {
      createConnection(db, { id: "conn-gh" });
      createAppState(db, {
        id: "github",
        displayName: "GitHub",
        iconPath: "/icons/github.svg",
        isConnected: true,
        connectionId: "conn-gh",
        category: "vcs",
        sortOrder: 10,
      });

      const result = await appsService.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        const app = result.data[0];
        expect(app.id).toBe("github");
        expect(app.displayName).toBe("GitHub");
        expect(app.iconPath).toBe("/icons/github.svg");
        expect(app.isConnected).toBe(true);
        expect(app.connectionId).toBe("conn-gh");
        expect(app.category).toBe("vcs");
        expect(app.sortOrder).toBe(10);
      }
    });

    it("returns apps ordered by sortOrder descending", async () => {
      createAppState(db, { id: "low", displayName: "Low", sortOrder: 1 });
      createAppState(db, { id: "high", displayName: "High", sortOrder: 100 });
      createAppState(db, { id: "mid", displayName: "Mid", sortOrder: 50 });

      const result = await appsService.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].id).toBe("high");
        expect(result.data[1].id).toBe("mid");
        expect(result.data[2].id).toBe("low");
      }
    });

    it("returns apps with default field values", async () => {
      createAppState(db, { id: "minimal" });

      const result = await appsService.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        const app = result.data[0];
        expect(app.id).toBe("minimal");
        expect(app.isConnected).toBe(false);
        expect(app.connectionId).toBeNull();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateById
  // ─────────────────────────────────────────────────────────────
  describe("updateById", () => {
    it("updates an app successfully", async () => {
      createConnection(db, { id: "conn-1" });
      createAppState(db, { id: "github", isConnected: false });

      const result = await appsService.updateById("github", {
        isConnected: true,
        connectionId: "conn-1",
      });
      expect(result.success).toBe(true);
    });

    it("persists the update in the database", async () => {
      createConnection(db, { id: "conn-123" });
      createAppState(db, { id: "github", isConnected: false });

      await appsService.updateById("github", {
        isConnected: true,
        connectionId: "conn-123",
      });

      const allResult = await appsService.getAll();
      expect(allResult.success).toBe(true);
      if (allResult.success) {
        const app = allResult.data.find((a) => a.id === "github");
        expect(app).toBeDefined();
        expect(app!.isConnected).toBe(true);
        expect(app!.connectionId).toBe("conn-123");
      }
    });

    it("disconnects an app by setting isConnected to false", async () => {
      createConnection(db, { id: "conn-1" });
      createAppState(db, { id: "github", isConnected: true, connectionId: "conn-1" });

      await appsService.updateById("github", {
        isConnected: false,
      });

      const allResult = await appsService.getAll();
      expect(allResult.success).toBe(true);
      if (allResult.success) {
        const app = allResult.data.find((a) => a.id === "github");
        expect(app!.isConnected).toBe(false);
        expect(app!.connectionId).toBeNull();
      }
    });

    it("clears connectionId when not provided", async () => {
      createConnection(db, { id: "conn-1" });
      createAppState(db, { id: "github", isConnected: true, connectionId: "conn-1" });

      await appsService.updateById("github", {
        isConnected: true,
      });

      const allResult = await appsService.getAll();
      expect(allResult.success).toBe(true);
      if (allResult.success) {
        const app = allResult.data.find((a) => a.id === "github");
        // connectionId should be null when not provided (repo uses `data.connectionId || null`)
        expect(app!.connectionId).toBeNull();
      }
    });

    it("returns success: true with data: null", async () => {
      createAppState(db, { id: "github" });

      const result = await appsService.updateById("github", { isConnected: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    // ── Validation: id ──────────────────────────────────────────
    it("rejects invalid id (empty string)", async () => {
      const result = await appsService.updateById("", { isConnected: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid app ID");
      }
    });

    it("rejects non-string id (number)", async () => {
      const result = await appsService.updateById(42, { isConnected: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid app ID");
      }
    });

    it("rejects null id", async () => {
      const result = await appsService.updateById(null, { isConnected: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid app ID");
      }
    });

    it("rejects undefined id", async () => {
      const result = await appsService.updateById(undefined, { isConnected: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid app ID");
      }
    });

    // ── Validation: payload ─────────────────────────────────────
    it("rejects null payload", async () => {
      const result = await appsService.updateById("github", null);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid payload");
      }
    });

    it("rejects undefined payload", async () => {
      const result = await appsService.updateById("github", undefined);
      expect(result.success).toBe(false);
    });

    it("rejects non-object payload (string)", async () => {
      const result = await appsService.updateById("github", "bad");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid payload");
      }
    });

    it("rejects non-object payload (number)", async () => {
      const result = await appsService.updateById("github", 123);
      expect(result.success).toBe(false);
    });

    it("rejects payload with non-boolean isConnected", async () => {
      const result = await appsService.updateById("github", {
        isConnected: "yes",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("isConnected must be a boolean");
      }
    });

    it("rejects payload missing isConnected", async () => {
      const result = await appsService.updateById("github", {
        connectionId: "conn-1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("isConnected must be a boolean");
      }
    });

    it("accepts payload with non-string connectionId (normalizes to null)", async () => {
      createAppState(db, { id: "github" });

      const result = await appsService.updateById("github", {
        isConnected: true,
        connectionId: 123,
      });
      // Validation passes — connectionId is normalized to null if not a string
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error handling (coverage for catch blocks)
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getAll returns error on repo failure", async () => {
      vi.spyOn(appsRepo, "findAll").mockRejectedValueOnce(new Error("db crash"));
      const result = await appsService.getAll();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch apps");
      }
    });

    it("updateById returns error on repo failure", async () => {
      vi.spyOn(appsRepo, "updateById").mockRejectedValueOnce(new Error("db crash"));
      const result = await appsService.updateById("github", { isConnected: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update app state");
      }
    });
  });
});
