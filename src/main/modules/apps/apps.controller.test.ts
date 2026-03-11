import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAppState } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { appsController } from "./apps.controller";

describe("appsController", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("getAll", () => {
    it("returns empty array when no apps exist", async () => {
      const result = await appsController.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns all app states", async () => {
      createAppState(db, { id: "github", displayName: "GitHub" });
      createAppState(db, { id: "linear", displayName: "Linear" });

      const result = await appsController.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("updateById", () => {
    it("updates an existing app state", async () => {
      createAppState(db, { id: "github", isConnected: false });

      const result = await appsController.updateById("github", {
        isConnected: true,
      });
      expect(result.success).toBe(true);
    });

    it("returns error for invalid id", async () => {
      const result = await appsController.updateById(null, { isConnected: true });
      expect(result.success).toBe(false);
    });

    it("returns error for invalid payload", async () => {
      const result = await appsController.updateById("github", null);
      expect(result.success).toBe(false);
    });
  });
});
