import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
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

import { connectionStatesService } from "./connectionStates.service";
import { connectionStatesRepo } from "./connectionStates.repo";

describe("connectionStatesService", () => {
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
    it("returns empty list when no connection", async () => {
      const result = await connectionStatesService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns all connections", async () => {
      createConnectionState(db, { id: "github", displayName: "GitHub" });
      createConnectionState(db, { id: "linear", displayName: "Linear" });

      const result = await connectionStatesService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it("returns connections with correct fields", async () => {
      createConnection(db, { id: "conn-gh" });
      createConnectionState(db, {
        id: "github",
        displayName: "GitHub",
        iconPath: "/icons/github.svg",
        isConnected: true,
        connectionId: "conn-gh",
        category: "vcs",
        sortOrder: 10,
      });

      const result = await connectionStatesService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        const connection = result.data[0];
        expect(connection.id).toBe("github");
        expect(connection.displayName).toBe("GitHub");
        expect(connection.iconPath).toBe("/icons/github.svg");
        expect(connection.isConnected).toBe(true);
        expect(connection.connectionId).toBe("conn-gh");
        expect(connection.category).toBe("vcs");
        expect(connection.sortOrder).toBe(10);
      }
    });

    it("returns connections ordered by sortOrder descending", async () => {
      createConnectionState(db, { id: "low", displayName: "Low", sortOrder: 1 });
      createConnectionState(db, { id: "high", displayName: "High", sortOrder: 100 });
      createConnectionState(db, { id: "mid", displayName: "Mid", sortOrder: 50 });

      const result = await connectionStatesService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data[0].id).toBe("high");
        expect(result.data[1].id).toBe("mid");
        expect(result.data[2].id).toBe("low");
      }
    });

    it("returns connection with default field values", async () => {
      createConnectionState(db, { id: "minimal" });

      const result = await connectionStatesService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        const connection = result.data[0];
        expect(connection.id).toBe("minimal");
        expect(connection.isConnected).toBe(false);
        expect(connection.connectionId).toBeNull();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateById
  // ─────────────────────────────────────────────────────────────
  describe("updateById", () => {
    it("updates an connection successfully", async () => {
      createConnection(db, { id: "conn-1" });
      createConnectionState(db, { id: "github", isConnected: false });

      const result = await connectionStatesService.updateById("github", {
        isConnected: true,
        connectionId: "conn-1",
      });
      assertOk(result);
    });

    it("persists the update in the database", async () => {
      createConnection(db, { id: "conn-123" });
      createConnectionState(db, { id: "github", isConnected: false });

      await connectionStatesService.updateById("github", {
        isConnected: true,
        connectionId: "conn-123",
      });

      const allResult = await connectionStatesService.getAll();
      assertOk(allResult);
      if (allResult.success) {
        const connection = allResult.data.find((a) => a.id === "github");
        expect(connection).toBeDefined();
        expect(connection!.isConnected).toBe(true);
        expect(connection!.connectionId).toBe("conn-123");
      }
    });

    it("disconnects an connection by setting isConnected to false", async () => {
      createConnection(db, { id: "conn-1" });
      createConnectionState(db, { id: "github", isConnected: true, connectionId: "conn-1" });

      await connectionStatesService.updateById("github", {
        isConnected: false,
      });

      const allResult = await connectionStatesService.getAll();
      assertOk(allResult);
      if (allResult.success) {
        const connection = allResult.data.find((a) => a.id === "github");
        expect(connection!.isConnected).toBe(false);
        expect(connection!.connectionId).toBeNull();
      }
    });

    it("clears connectionId when not provided", async () => {
      createConnection(db, { id: "conn-1" });
      createConnectionState(db, { id: "github", isConnected: true, connectionId: "conn-1" });

      await connectionStatesService.updateById("github", {
        isConnected: true,
      });

      const allResult = await connectionStatesService.getAll();
      assertOk(allResult);
      if (allResult.success) {
        const connection = allResult.data.find((a) => a.id === "github");
        // connectionId should be null when not provided (repo uses `data.connectionId || null`)
        expect(connection!.connectionId).toBeNull();
      }
    });

    it("returns success: true with data: null", async () => {
      createConnectionState(db, { id: "github" });

      const result = await connectionStatesService.updateById("github", { isConnected: true });
      assertOk(result);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    // ── Validation: id ──────────────────────────────────────────
    it("rejects invalid id (empty string)", async () => {
      const result = await connectionStatesService.updateById("", { isConnected: true });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Invalid connection ID");
      }
    });

    it("rejects non-string id (number)", async () => {
      const result = await connectionStatesService.updateById(42, { isConnected: true });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Invalid connection ID");
      }
    });

    it("rejects null id", async () => {
      const result = await connectionStatesService.updateById(null, { isConnected: true });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Invalid connection ID");
      }
    });

    it("rejects undefined id", async () => {
      const result = await connectionStatesService.updateById(undefined, { isConnected: true });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Invalid connection ID");
      }
    });

    // ── Validation: payload ─────────────────────────────────────
    it("rejects null payload", async () => {
      const result = await connectionStatesService.updateById("github", null);
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Invalid payload");
      }
    });

    it("rejects undefined payload", async () => {
      const result = await connectionStatesService.updateById("github", undefined);
      assertFail(result);
    });

    it("rejects non-object payload (string)", async () => {
      const result = await connectionStatesService.updateById("github", "bad");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Invalid payload");
      }
    });

    it("rejects non-object payload (number)", async () => {
      const result = await connectionStatesService.updateById("github", 123);
      assertFail(result);
    });

    it("rejects payload with non-boolean isConnected", async () => {
      const result = await connectionStatesService.updateById("github", {
        isConnected: "yes",
      });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("isConnected must be a boolean");
      }
    });

    it("rejects payload missing isConnected", async () => {
      const result = await connectionStatesService.updateById("github", {
        connectionId: "conn-1",
      });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("isConnected must be a boolean");
      }
    });

    it("accepts payload with non-string connectionId (normalizes to null)", async () => {
      createConnectionState(db, { id: "github" });

      const result = await connectionStatesService.updateById("github", {
        isConnected: true,
        connectionId: 123,
      });
      // Validation passes — connectionId is normalized to null if not a string
      assertOk(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error handling (coverage for catch blocks)
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getAll returns error on repo failure", async () => {
      vi.spyOn(connectionStatesRepo, "findAll").mockRejectedValueOnce(new Error("db crash"));
      const result = await connectionStatesService.getAll();
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch connnectionStates");
      }
    });

    it("updateById returns error on repo failure", async () => {
      vi.spyOn(connectionStatesRepo, "updateById").mockRejectedValueOnce(new Error("db crash"));
      const result = await connectionStatesService.updateById("github", { isConnected: true });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Failed to update connection state");
      }
    });
  });
});
