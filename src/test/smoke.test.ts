/**
 * Smoke Tests
 *
 * Verifies that the database bootstraps correctly with seed data
 * and that core service calls return expected results.
 *
 * Uses real in-memory SQLite — no mocks.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "./setup-db";
import type { DatabaseInstance } from "../main/db/types";
import type Database from "better-sqlite3";

// ── DB mock — all services call getDb() internally ──────────
let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

import { vi } from "vitest";
vi.mock("../main/db/client", () => ({
  getDb: () => db,
}));

// ── Seed runner ─────────────────────────────────────────────
import { runSeeds, CURRENT_SEED_VERSION } from "../main/db/seeds";

// ── Services under test ─────────────────────────────────────
import { accountService } from "../main/modules/account/account.service";
import { appSettingsService } from "../main/modules/appSettings/appSettings.service";
import { spaceService } from "../main/modules/space/space.service";
import { providersService } from "../main/modules/providers/providers.service";
import { connectionStatesService } from "../main/modules/connectionStates/connectionStates.service";
import { projectsService } from "../main/modules/projects/projects.service";
import { workspacesService } from "../main/modules/workspaces/workspaces.service";
import { entitiesService } from "../main/modules/entities/entities.service";

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────
describe("smoke", () => {
  beforeAll(async () => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());

    // Run versioned seeds (mirrors production boot)
    await runSeeds(db);
  });

  afterAll(() => {
    cleanup();
  });

  // ───────────────────────────────────────────────────────────
  // 2. DB Bootstrap — seed data integrity
  // ───────────────────────────────────────────────────────────
  describe("db bootstrap", () => {
    it("seeds default account", async () => {
      const account = await accountService.ensureAccount();
      expect(account).not.toBeNull();
      expect(account.id).toBe("default");
      expect(account.timezone).toBe("UTC");
      expect(account.locale).toBe("en-US");
    });

    it("seeds two providers (copilot_cli, claude_code)", async () => {
      const result = await providersService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const ids = result.data!.map((p) => p.id);
      expect(ids).toContain("copilot_cli");
      expect(ids).toContain("claude_code");
      expect(result.data!.length).toBeGreaterThanOrEqual(2);

      // Both should be agent_runtime and enabled
      for (const p of result.data!) {
        expect(p.kind).toBe("agent_runtime");
        expect(p.isEnabled).toBe(true);
      }
    });

    it("seeds two spaces (claude, copilot)", async () => {
      const result = await spaceService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const slugs = result.data.map((s) => s.slug);
      expect(slugs).toContain("claude");
      expect(slugs).toContain("copilot");
    });

    it("seeds app settings with activeSpaceId=claude", async () => {
      const result = await appSettingsService.getSettings();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.id).toBe("default");
      expect(result.data.accountId).toBe("default");
      expect(result.data.activeSpaceId).toBe("claude");
    });

    it("sets seedVersion to current version", async () => {
      const result = await appSettingsService.getSettings();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.seedVersion).toBe(CURRENT_SEED_VERSION);
    });

    it("runSeeds is idempotent (no-op on second call)", async () => {
      // Should not throw or duplicate data
      await runSeeds(db);

      const result = await providersService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.length).toBe(3);
    });

    it("seeds connection states for all integrations", async () => {
      const result = await connectionStatesService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const ids = result.data.map((a) => a.id);
      expect(ids).toContain("github");
      expect(ids).toContain("linear");
      expect(ids).toContain("jira");
      expect(ids).toContain("gitlab");
      expect(ids).toContain("asana");
      expect(ids).toContain("trello");

      // All should be disconnected by default
      for (const app of result.data) {
        expect(app.isConnected).toBe(false);
      }
    });

    it("seeds seven connections (all revoked)", async () => {
      // Query connections table directly since connectionsService needs more setup
      const rows = db.query.connections.findMany().sync?.() ?? [];
      expect(rows.length).toBe(8);

      const providers = rows.map((r: { provider: string }) => r.provider);
      expect(providers).toContain("github");
      expect(providers).toContain("linear");
      expect(providers).toContain("gitlab");
      expect(providers).toContain("jira");
      expect(providers).toContain("asana");
      expect(providers).toContain("trello");
      expect(providers).toContain("sentry");

      for (const row of rows) {
        expect((row as { status: string }).status).toBe("revoked");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. Service round-trip — basic calls return valid responses
  // ───────────────────────────────────────────────────────────
  describe("service round-trip", () => {
    it("accountService.getAccount returns formatted account", async () => {
      const result = await accountService.getAccount();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.id).toBe("default");
      expect(result.data.timezone).toBe("UTC");
      expect(result.data.locale).toBe("en-US");
    });

    it("appSettingsService.getSettings returns settings", async () => {
      const result = await appSettingsService.getSettings();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data).toHaveProperty("id");
      expect(result.data).toHaveProperty("accountId");
      expect(result.data).toHaveProperty("activeSpaceId");
    });

    it("spaceService.getAll returns seeded spaces", async () => {
      const result = await spaceService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      // Each space should have required fields
      for (const space of result.data) {
        expect(space).toHaveProperty("id");
        expect(space).toHaveProperty("name");
        expect(space).toHaveProperty("slug");
        expect(space).toHaveProperty("accountId", "default");
      }
    });

    it("providersService.getAll returns enabled agent runtimes", async () => {
      const result = await providersService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;

      for (const p of result.data!) {
        expect(p).toHaveProperty("id");
        expect(p).toHaveProperty("displayName");
        expect(p).toHaveProperty("kind");
        expect(p).toHaveProperty("isEnabled");
      }
    });

    it("projectsService.getAll returns empty list (no projects seeded)", async () => {
      const result = await projectsService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data).toEqual([]);
    });

    it("workspacesService.getAll returns empty list (no workspaces seeded)", async () => {
      const result = await workspacesService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data).toEqual([]);
    });

    it("entitiesService.getAll returns empty list (no entities seeded)", async () => {
      const result = await entitiesService.getAll();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data).toEqual([]);
    });

    it("accountService.updateAccount round-trips correctly", async () => {
      const updateResult = await accountService.updateAccount({
        displayName: "Smoke Test User",
      });
      expect(updateResult.success).toBe(true);

      const getResult = await accountService.getAccount();
      expect(getResult.success).toBe(true);
      if (!getResult.success) return;

      expect(getResult.data.displayName).toBe("Smoke Test User");
    });

    it("appSettingsService.setActiveSpace changes activeSpaceId", async () => {
      const result = await appSettingsService.setActiveSpace("copilot");
      expect(result.success).toBe(true);

      const settings = await appSettingsService.getSettings();
      expect(settings.success).toBe(true);
      if (!settings.success) return;

      expect(settings.data.activeSpaceId).toBe("copilot");

      // Restore
      await appSettingsService.setActiveSpace("claude");
    });

    it("spaceService.getById returns specific space", async () => {
      const result = await spaceService.getById("claude");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.id).toBe("claude");
      expect(result.data.slug).toBe("claude");
    });

    it("spaceService.getById returns error for nonexistent", async () => {
      const result = await spaceService.getById("nonexistent");
      expect(result.success).toBe(false);
    });
  });
});
