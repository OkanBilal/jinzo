import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";
import { spaces, appSettings } from "../../db/schema";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { seedSpacesData } from "./seed-spaces";
import { seedSpaces } from "../data/spaces";

describe("seedSpacesData", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    // Ensure account exists for FK constraint
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  it("inserts all seed spaces", async () => {
    await seedSpacesData();
    const rows = db.select().from(spaces).all();
    expect(rows).toHaveLength(seedSpaces.length);
  });

  it("inserts space with correct fields", async () => {
    await seedSpacesData();
    const claude = db.select().from(spaces).all().find((r) => r.id === "claude");
    expect(claude).toBeDefined();
    expect(claude!.name).toBe("Claude");
    expect(claude!.slug).toBe("claude");
    expect(claude!.accountId).toBe("default");
  });

  it("serializes themeConfig and uiConfig as JSON", async () => {
    await seedSpacesData();
    const claude = db.select().from(spaces).all().find((r) => r.id === "claude");
    expect(claude!.themeConfig).not.toBeNull();
    const theme = JSON.parse(claude!.themeConfig!);
    expect(theme.lightBackground).toBe("#f2dbcfa6");
  });

  it("creates or updates appSettings with activeSpaceId", async () => {
    await seedSpacesData();
    const settings = db.select().from(appSettings).all();
    expect(settings).toHaveLength(1);
    expect(settings[0].activeSpaceId).toBe("claude");
  });

  it("is idempotent (onConflictDoNothing for spaces)", async () => {
    await seedSpacesData();
    await seedSpacesData();
    const rows = db.select().from(spaces).all();
    expect(rows).toHaveLength(seedSpaces.length);
  });
});
