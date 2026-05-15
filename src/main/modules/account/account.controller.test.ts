import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { accountController } from "./account.controller";

describe("accountController", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("get", () => {
    it("returns the default account", async () => {
      const result = await accountController.get();
      assertOk(result);
      if (result.success) {
        expect(result.data.id).toBe("default");
      }
    });

    it("returns existing account data", async () => {
      createAccount(db, { id: "default", displayName: "Okan" });

      const result = await accountController.get();
      assertOk(result);
      if (result.success) {
        expect(result.data.displayName).toBe("Okan");
      }
    });
  });

  describe("update", () => {
    it("updates and returns the account", async () => {
      const result = await accountController.update({
        displayName: "New Name",
        bio: "Developer",
      });

      assertOk(result);
      if (result.success) {
        expect(result.data.displayName).toBe("New Name");
        expect(result.data.bio).toBe("Developer");
      }
    });

    it("returns errors for invalid payload", async () => {
      const result = await accountController.update(null);
      assertFail(result);
    });
  });
});
