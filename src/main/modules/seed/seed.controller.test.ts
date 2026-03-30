import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./seed.service", () => ({
  seedService: {
    seedAccounts: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
    seedConnectionStates: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
    seedConnections: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
    seedProviders: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
    seedSpaces: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
    seedAll: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
  },
}));

import { seedController } from "./seed.controller";
import { seedService } from "./seed.service";

describe("seedController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seedAccounts delegates to seedService.seedAccounts", async () => {
    const result = await seedController.seedAccounts();
    expect(seedService.seedAccounts).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, message: "ok" });
  });

  it("seedConnectionStates delegates to seedService.seedConnectionStates", async () => {
    const result = await seedController.seedConnectionStates();
    expect(seedService.seedConnectionStates).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, message: "ok" });
  });

  it("seedConnections delegates to seedService.seedConnections", async () => {
    const result = await seedController.seedConnections();
    expect(seedService.seedConnections).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, message: "ok" });
  });

  it("seedProviders delegates to seedService.seedProviders", async () => {
    const result = await seedController.seedProviders();
    expect(seedService.seedProviders).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, message: "ok" });
  });

  it("seedSpaces delegates to seedService.seedSpaces", async () => {
    const result = await seedController.seedSpaces();
    expect(seedService.seedSpaces).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, message: "ok" });
  });

  it("seedAll delegates to seedService.seedAll", async () => {
    const result = await seedController.seedAll();
    expect(seedService.seedAll).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, message: "ok" });
  });
});
