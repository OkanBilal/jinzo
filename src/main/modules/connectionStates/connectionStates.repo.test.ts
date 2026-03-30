import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createConnectionState, createConnection } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { connectionStatesRepo } from "./connectionStates.repo";

describe("connectionStatesRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("findAll", () => {
    it("returns empty array when no connection states", async () => {
      const result = await connectionStatesRepo.findAll();
      expect(result).toEqual([]);
    });

    it("returns all connection states ordered by sortOrder desc", async () => {
      createConnectionState(db, { id: "github", displayName: "GitHub", sortOrder: 1 });
      createConnectionState(db, { id: "linear", displayName: "Linear", sortOrder: 2 });

      const result = await connectionStatesRepo.findAll();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("linear");
      expect(result[1].id).toBe("github");
    });
  });

  describe("updateById", () => {
    it("updates isConnected and connectionId", async () => {
      createConnection(db, { id: "conn-1" });
      createConnectionState(db, { id: "github", isConnected: false });

      await connectionStatesRepo.updateById("github", {
        isConnected: true,
        connectionId: "conn-1",
      });

      const connectionStates = await connectionStatesRepo.findAll();
      const github = connectionStates.find((a) => a.id === "github");
      expect(github!.isConnected).toBe(true);
      expect(github!.connectionId).toBe("conn-1");
    });

    it("sets connectionId to null when not provided", async () => {
      createConnection(db, { id: "old-conn" });
      createConnectionState(db, { id: "github", connectionId: "old-conn" });

      await connectionStatesRepo.updateById("github", {
        isConnected: false,
      });

      const connectionStates = await connectionStatesRepo.findAll();
      const github = connectionStates.find((a) => a.id === "github");
      expect(github!.connectionId).toBeNull();
    });
  });
});
