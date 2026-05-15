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

import { accountService } from "./account.service";
import { accountRepo } from "./account.repo";

describe("accountService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("ensureAccount", () => {
    it("creates the default account when it does not exist", async () => {
      const account = await accountService.ensureAccount();
      expect(account).not.toBeNull();
      expect(account.id).toBe("default");
      expect(account.timezone).toBe("UTC");
    });

    it("returns existing account on subsequent calls", async () => {
      createAccount(db, { id: "default", displayName: "Existing" });

      const account = await accountService.ensureAccount();
      expect(account.displayName).toBe("Existing");
    });
  });

  describe("getAccount", () => {
    it("returns success response with formatted account", async () => {
      const result = await accountService.getAccount();
      assertOk(result);
      if (result.success) {
        expect(result.data.id).toBe("default");
        // formatAccountResponse defaults
        expect(result.data.timezone).toBe("UTC");
        expect(result.data.locale).toBe("en-US");
      }
    });
  });

  describe("updateAccount", () => {
    it("updates with valid payload", async () => {
      const result = await accountService.updateAccount({
        displayName: "Updated Name",
      });
      assertOk(result);
      if (result.success) {
        expect(result.data.displayName).toBe("Updated Name");
      }
    });

    it("returns errors for invalid payload", async () => {
      const result = await accountService.updateAccount(null);
      assertFail(result);
    });

    it("returns error for empty update", async () => {
      const result = await accountService.updateAccount({});
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("No fields to update");
      }
    });

    it("returns validation errors for invalid email", async () => {
      const result = await accountService.updateAccount({
        email: "not-an-email",
      });
      assertFail(result);
      expect(result.error).toContain("email: Invalid email");
    });

    it("updates multiple fields", async () => {
      const result = await accountService.updateAccount({
        displayName: "New Name",
        email: "valid@test.com",
        bio: "Hello world",
      });
      assertOk(result);
      if (result.success) {
        expect(result.data.displayName).toBe("New Name");
        expect(result.data.email).toBe("valid@test.com");
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error paths
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getAccount returns error on failure", async () => {
      vi.spyOn(accountRepo, "findById").mockRejectedValueOnce(new Error("db"));
      const result = await accountService.getAccount();
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch account");
      }
    });

    it("updateAccount returns error on failure", async () => {
      vi.spyOn(accountRepo, "update").mockRejectedValueOnce(new Error("db"));
      const result = await accountService.updateAccount({ displayName: "X" });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Failed to update account");
      }
    });
  });
});
