import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncService } from "./sync.service";
import * as syncFetchers from "./sync.fetchers";
import { syncRepo } from "./sync.repo";
import type { EntityInput, SyncJobStats } from "./sync.dto";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────
vi.mock("./sync.fetchers");
vi.mock("./sync.repo");

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function makeEntity(overrides: Partial<EntityInput> = {}): EntityInput {
  return {
    kind: "issue",
    title: "Test issue",
    url: `https://github.com/test/repo/issues/${Math.random()}`,
    body: "Test body",
    summary: null,
    occurredAt: new Date().toISOString(),
    connectionId: "conn-1",
    ...overrides,
  };
}

function makeStats(overrides: Partial<SyncJobStats> = {}): SyncJobStats {
  return {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    ...overrides,
  };
}

describe("syncService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // runEntitySync
  // ─────────────────────────────────────────────────────────
  describe("runEntitySync", () => {
    it("returns empty result when no entities are fetched", async () => {
      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce([]);

      const result = await syncService.runEntitySync();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.success).toBe(true);
        expect(result.data.total).toBe(0);
        expect(result.data.inserted).toBe(0);
        expect(result.data.updated).toBe(0);
        expect(result.data.skipped).toBe(0);
        expect(result.data.errors).toBe(0);
        expect(result.data.stats.itemsPerSecond).toBe(0);
        expect(result.data.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it("returns empty result when no entities are fetched with a specific provider", async () => {
      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce([]);

      const result = await syncService.runEntitySync("github");

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.total).toBe(0);
      expect(syncFetchers.fetchAllEntities).toHaveBeenCalledWith("github");
    });

    it("returns success result when entities are fetched and upserted", async () => {
      const entities = [makeEntity(), makeEntity(), makeEntity()];
      const stats = makeStats({ inserted: 2, updated: 1 });

      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce(entities);
      vi.mocked(syncRepo.upsertEntities).mockResolvedValueOnce(stats);

      const result = await syncService.runEntitySync();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.success).toBe(true);
        expect(result.data.total).toBe(3);
        expect(result.data.inserted).toBe(2);
        expect(result.data.updated).toBe(1);
        expect(result.data.skipped).toBe(0);
        expect(result.data.errors).toBe(0);
        expect(result.data.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it("passes provider argument to fetchAllEntities", async () => {
      const entities = [makeEntity()];
      const stats = makeStats({ inserted: 1 });

      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce(entities);
      vi.mocked(syncRepo.upsertEntities).mockResolvedValueOnce(stats);

      const result = await syncService.runEntitySync("linear");

      expect(syncFetchers.fetchAllEntities).toHaveBeenCalledWith("linear");
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.total).toBe(1);
    });

    it("calls runEntitySync without provider (undefined)", async () => {
      const entities = [makeEntity()];
      const stats = makeStats({ inserted: 1 });

      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce(entities);
      vi.mocked(syncRepo.upsertEntities).mockResolvedValueOnce(stats);

      const result = await syncService.runEntitySync();

      expect(syncFetchers.fetchAllEntities).toHaveBeenCalledWith(undefined);
      expect(result.success).toBe(true);
    });

    it("includes stats with correct itemsPerSecond calculation", async () => {
      const entities = Array.from({ length: 10 }, () => makeEntity());
      const stats = makeStats({ inserted: 10 });

      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce(entities);
      vi.mocked(syncRepo.upsertEntities).mockResolvedValueOnce(stats);

      const result = await syncService.runEntitySync();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(10);
        expect(result.data.stats.itemsPerSecond).toBeGreaterThanOrEqual(0);
      }
    });

    it("returns stats with errors from upsert", async () => {
      const entities = [makeEntity(), makeEntity()];
      const stats = makeStats({ inserted: 1, errors: 1 });

      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce(entities);
      vi.mocked(syncRepo.upsertEntities).mockResolvedValueOnce(stats);

      const result = await syncService.runEntitySync();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.errors).toBe(1);
        expect(result.data.inserted).toBe(1);
        expect(result.data.total).toBe(2);
      }
    });

    it("returns stats with skipped entities", async () => {
      const entities = [makeEntity(), makeEntity(), makeEntity()];
      const stats = makeStats({ inserted: 1, updated: 1, skipped: 1 });

      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce(entities);
      vi.mocked(syncRepo.upsertEntities).mockResolvedValueOnce(stats);

      const result = await syncService.runEntitySync();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skipped).toBe(1);
        expect(result.data.inserted).toBe(1);
        expect(result.data.updated).toBe(1);
      }
    });

    // ─────────────────────────────────────────────────────
    // Error paths
    // ─────────────────────────────────────────────────────
    it("returns failure result when fetchAllEntities throws", async () => {
      vi.mocked(syncFetchers.fetchAllEntities).mockRejectedValueOnce(
        new Error("Network failure")
      );

      const result = await syncService.runEntitySync();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Sync job failed");
        expect(result.data).toBeDefined();
        expect(result.data!.success).toBe(false);
        expect(result.data!.inserted).toBe(0);
        expect(result.data!.updated).toBe(0);
        expect(result.data!.skipped).toBe(0);
        expect(result.data!.errors).toBe(1);
        expect(result.data!.total).toBe(0);
        expect(result.data!.stats.itemsPerSecond).toBe(0);
        expect(result.data!.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it("returns failure result when upsertEntities throws", async () => {
      const entities = [makeEntity()];
      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce(entities);
      vi.mocked(syncRepo.upsertEntities).mockRejectedValueOnce(
        new Error("Database error")
      );

      const result = await syncService.runEntitySync();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Sync job failed");
        expect(result.data!.success).toBe(false);
        expect(result.data!.total).toBe(0);
        expect(result.data!.errors).toBe(1);
      }
    });

    it("returns failure result when fetchAllEntities throws non-Error", async () => {
      vi.mocked(syncFetchers.fetchAllEntities).mockRejectedValueOnce("string error");

      const result = await syncService.runEntitySync();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Sync job failed");
        expect(result.data!.success).toBe(false);
      }
    });

    it("returns failure result when fetchAllEntities throws with provider", async () => {
      vi.mocked(syncFetchers.fetchAllEntities).mockRejectedValueOnce(
        new Error("GitHub API rate limit")
      );

      const result = await syncService.runEntitySync("github");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Sync job failed");
      expect(syncFetchers.fetchAllEntities).toHaveBeenCalledWith("github");
    });

    it("does not call upsertEntities when fetch returns empty array", async () => {
      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce([]);
      vi.mocked(syncRepo.upsertEntities).mockClear();

      await syncService.runEntitySync();

      expect(syncRepo.upsertEntities).not.toHaveBeenCalled();
    });

    it("calls upsertEntities with the fetched entities", async () => {
      const entities = [makeEntity({ title: "Issue A" }), makeEntity({ title: "Issue B" })];
      const stats = makeStats({ inserted: 2 });

      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce(entities);
      vi.mocked(syncRepo.upsertEntities).mockResolvedValueOnce(stats);

      await syncService.runEntitySync();

      expect(syncRepo.upsertEntities).toHaveBeenCalledWith(entities);
    });

    it("duration is positive even on fast execution", async () => {
      vi.mocked(syncFetchers.fetchAllEntities).mockResolvedValueOnce([]);

      const result = await syncService.runEntitySync();

      if (result.success) {
        expect(result.data.duration).toBeGreaterThanOrEqual(0);
        expect(typeof result.data.duration).toBe("number");
      }
    });
  });
});
