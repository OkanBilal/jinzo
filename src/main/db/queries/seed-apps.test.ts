import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";
import { appStates } from "../../db/schema";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { seedApps } from "./seed-apps";
import { apps } from "../data/apps";

describe("seedApps", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  it("inserts all app states", async () => {
    await seedApps();
    const rows = db.select().from(appStates).all();
    expect(rows).toHaveLength(apps.length);
  });

  it("inserts app state with correct fields", async () => {
    await seedApps();
    const row = db.select().from(appStates).all().find((r) => r.id === "github");
    expect(row).toBeDefined();
    expect(row!.displayName).toBe("GitHub");
    expect(row!.isConnected).toBe(false);
    expect(row!.category).toBe("developer-tools");
  });

  it("sets sortOrder based on array index", async () => {
    await seedApps();
    const rows = db.select().from(appStates).all();
    const github = rows.find((r) => r.id === "github");
    expect(github!.sortOrder).toBe(0);
  });

  it("is idempotent (onConflictDoNothing)", async () => {
    await seedApps();
    await seedApps();
    const rows = db.select().from(appStates).all();
    expect(rows).toHaveLength(apps.length);
  });
});
