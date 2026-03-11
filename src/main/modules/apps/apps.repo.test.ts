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

import { appsRepo } from "./apps.repo";

describe("appsRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("findAll", () => {
    it("returns empty array when no apps", async () => {
      const result = await appsRepo.findAll();
      expect(result).toEqual([]);
    });

    it("returns all apps ordered by sortOrder desc", async () => {
      createAppState(db, { id: "github", displayName: "GitHub", sortOrder: 1 });
      createAppState(db, { id: "linear", displayName: "Linear", sortOrder: 2 });

      const result = await appsRepo.findAll();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("linear");
      expect(result[1].id).toBe("github");
    });
  });

  describe("updateById", () => {
    it("updates isConnected and connectionId", async () => {
      createConnection(db, { id: "conn-1" });
      createAppState(db, { id: "github", isConnected: false });

      await appsRepo.updateById("github", {
        isConnected: true,
        connectionId: "conn-1",
      });

      const apps = await appsRepo.findAll();
      const github = apps.find((a) => a.id === "github");
      expect(github!.isConnected).toBe(true);
      expect(github!.connectionId).toBe("conn-1");
    });

    it("sets connectionId to null when not provided", async () => {
      createConnection(db, { id: "old-conn" });
      createAppState(db, { id: "github", connectionId: "old-conn" });

      await appsRepo.updateById("github", {
        isConnected: false,
      });

      const apps = await appsRepo.findAll();
      const github = apps.find((a) => a.id === "github");
      expect(github!.connectionId).toBeNull();
    });
  });
});
