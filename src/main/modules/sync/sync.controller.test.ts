import { assertOk } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./sync.service", () => ({
  syncService: {
    runEntitySync: vi.fn().mockResolvedValue({ success: true, data: { inserted: 5, updated: 2, skipped: 0, errors: 0, total: 7, duration: 100, stats: { itemsPerSecond: 70 } } }),
  },
}));

import { syncController } from "./sync.controller";
import { syncService } from "./sync.service";

describe("syncController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runEntitySync delegates to syncService.runEntitySync", async () => {
    const result = await syncController.runEntitySync("github");
    expect(syncService.runEntitySync).toHaveBeenCalledWith("github");
    assertOk(result);
  });

  it("runEntitySync passes undefined provider", async () => {
    await syncController.runEntitySync();
    expect(syncService.runEntitySync).toHaveBeenCalledWith(undefined);
  });
});
