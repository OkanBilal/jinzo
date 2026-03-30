import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createConnectionState } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { ConnectionStatesController } from "./connectionStates.controller";

describe("ConnectionStatesController", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("getAll", () => {
    it("returns empty array when no connections exist", async () => {
      const result = await ConnectionStatesController.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns all connection states", async () => {
      createConnectionState(db, { id: "github", displayName: "GitHub" });
      createConnectionState(db, { id: "linear", displayName: "Linear" });

      const result = await ConnectionStatesController.getAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("updateById", () => {
    it("updates an existing connection state", async () => {
      createConnectionState(db, { id: "github", isConnected: false });

      const result = await ConnectionStatesController.updateById("github", {
        isConnected: true,
      });
      expect(result.success).toBe(true);
    });

    it("returns error for invalid id", async () => {
      const result = await ConnectionStatesController.updateById(null, { isConnected: true });
      expect(result.success).toBe(false);
    });

    it("returns error for invalid payload", async () => {
      const result = await ConnectionStatesController.updateById("github", null);
      expect(result.success).toBe(false);
    });
  });
});
