import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import type { DatabaseInstance } from "../types";
import type Database from "better-sqlite3";
import { connectionStates } from "../schema";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { seedConnectionStates } from "./seed-connectionStates";
import { connectionStatesData } from "../data/connectionStates";

describe("seedApstates", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  it("inserts all connection states", async () => {
    await seedConnectionStates();
    const rows = db.select().from(connectionStates).all();
    expect(rows).toHaveLength(connectionStatesData.length);
  });

  it("inserts connection state with correct fields", async () => {
    await seedConnectionStates();
    const row = db.select().from(connectionStates).all().find((r) => r.id === "github");
    expect(row).toBeDefined();
    expect(row!.displayName).toBe("GitHub");
    expect(row!.isConnected).toBe(false);
    expect(row!.category).toBe("issues");
  });

  it("sets sortOrder based on array index", async () => {
    await seedConnectionStates();
    const rows = db.select().from(connectionStates).all();
    const github = rows.find((r) => r.id === "github");
    expect(github!.sortOrder).toBe(0);
  });

  it("is idempotent (onConflictDoNothing)", async () => {
    await seedConnectionStates();
    await seedConnectionStates();
    const rows = db.select().from(connectionStates).all();
    expect(rows).toHaveLength(connectionStatesData.length);
  });
});
