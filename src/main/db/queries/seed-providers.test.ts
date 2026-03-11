import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";
import { providers } from "../../db/schema";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { seedProvidersData } from "./seed-providers";
import { seedProviders } from "../data/providers";

describe("seedProvidersData", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  it("inserts all seed providers", async () => {
    await seedProvidersData();
    const rows = db.select().from(providers).all();
    expect(rows).toHaveLength(seedProviders.length);
  });

  it("inserts provider with correct fields", async () => {
    await seedProvidersData();
    const row = db.select().from(providers).all().find((r) => r.id === "copilot_cli");
    expect(row).toBeDefined();
    expect(row!.kind).toBe("agent_runtime");
    expect(row!.displayName).toBe("GitHub Copilot (CLI/SDK)");
    expect(row!.isEnabled).toBe(true);
  });

  it("serializes config and capabilities as JSON", async () => {
    await seedProvidersData();
    const row = db.select().from(providers).all().find((r) => r.id === "copilot_cli");
    expect(row!.config).not.toBeNull();
    const config = JSON.parse(row!.config!);
    expect(config.transport).toBe("stdio");
  });

  it("is idempotent (onConflictDoNothing)", async () => {
    await seedProvidersData();
    await seedProvidersData();
    const rows = db.select().from(providers).all();
    expect(rows).toHaveLength(seedProviders.length);
  });
});
