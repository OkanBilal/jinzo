import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";
import { accounts } from "../../db/schema";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { seedAccountsData } from "./seed-accounts";
import { seedAccounts } from "../data/accounts";

describe("seedAccountsData", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  it("inserts all seed accounts", async () => {
    await seedAccountsData();
    const rows = db.select().from(accounts).all();
    expect(rows).toHaveLength(seedAccounts.length);
  });

  it("inserts account with correct fields", async () => {
    await seedAccountsData();
    const row = db.select().from(accounts).all()[0];
    expect(row.id).toBe("default");
    expect(row.displayName).toBe("User");
    expect(row.email).toBe("user@example.com");
  });

  it("is idempotent (onConflictDoNothing)", async () => {
    await seedAccountsData();
    await seedAccountsData();
    const rows = db.select().from(accounts).all();
    expect(rows).toHaveLength(seedAccounts.length);
  });
});
