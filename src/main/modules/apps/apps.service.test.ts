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

describe("appsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

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
  });

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

    it("rejects invalid id", async () => {
      const result = await appsService.updateById("", { isConnected: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid app ID");
      }
    });

    it("rejects non-string id", async () => {
      const result = await appsService.updateById(42, { isConnected: true });
      expect(result.success).toBe(false);
    });

    it("rejects invalid payload", async () => {
      const result = await appsService.updateById("github", null);
      expect(result.success).toBe(false);
    });

    it("rejects payload with non-boolean isConnected", async () => {
      const result = await appsService.updateById("github", {
        isConnected: "yes",
      });
      expect(result.success).toBe(false);
    });
  });
});
