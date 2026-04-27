import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";
import { connections } from "../../db/schema";
import { eq } from "drizzle-orm";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { seedConnections } from "./seed-connections";

describe("seedConnections", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  it("inserts all 6 provider connections", async () => {
    await seedConnections();
    const rows = db.select().from(connections).all();
    expect(rows).toHaveLength(7);
  });

  it("creates connections for each provider", async () => {
    await seedConnections();
    const providers = ["github", "linear", "gitlab", "jira", "asana", "trello"];
    for (const provider of providers) {
      const row = db
        .select()
        .from(connections)
        .where(eq(connections.provider, provider))
        .get();
      expect(row).toBeDefined();
      expect(row!.status).toBe("revoked");
      expect(row!.type).toBe("api_key");
    }
  });

  it("does not duplicate connections on re-run", async () => {
    await seedConnections();
    await seedConnections();
    const rows = db.select().from(connections).all();
    expect(rows).toHaveLength(7);
  });

  it("sets unique connection ids", async () => {
    await seedConnections();
    const rows = db.select().from(connections).all();
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(7);
  });
});
