import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/queries/seed-accounts", () => ({
  seedAccountsData: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../db/queries/seed-apps", () => ({
  seedApps: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../db/queries/seed-connections", () => ({
  seedConnections: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../db/queries/seed-providers", () => ({
  seedProvidersData: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../db/queries/seed-spaces", () => ({
  seedSpacesData: vi.fn().mockResolvedValue(undefined),
}));

import { seedService } from "./seed.service";
import { seedAccountsData } from "../../db/queries/seed-accounts";
import { seedApps } from "../../db/queries/seed-apps";
import { seedConnections } from "../../db/queries/seed-connections";
import { seedProvidersData } from "../../db/queries/seed-providers";
import { seedSpacesData } from "../../db/queries/seed-spaces";

describe("seedService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("seedAccounts", () => {
    it("returns success when seeding succeeds", async () => {
      const result = await seedService.seedAccounts();
      expect(result).toEqual({ success: true, message: "Accounts seeded successfully" });
      expect(seedAccountsData).toHaveBeenCalledOnce();
    });

    it("returns error when seeding fails", async () => {
      vi.mocked(seedAccountsData).mockRejectedValueOnce(new Error("DB error"));
      const result = await seedService.seedAccounts();
      expect(result).toEqual({ success: false, error: "DB error" });
    });
  });

  describe("seedApps", () => {
    it("returns success when seeding succeeds", async () => {
      const result = await seedService.seedApps();
      expect(result).toEqual({ success: true, message: "Apps seeded successfully" });
      expect(seedApps).toHaveBeenCalledOnce();
    });

    it("returns error when seeding fails", async () => {
      vi.mocked(seedApps).mockRejectedValueOnce(new Error("fail"));
      const result = await seedService.seedApps();
      expect(result).toEqual({ success: false, error: "fail" });
    });
  });

  describe("seedConnections", () => {
    it("returns success when seeding succeeds", async () => {
      const result = await seedService.seedConnections();
      expect(result).toEqual({ success: true, message: "Connections seeded successfully" });
      expect(seedConnections).toHaveBeenCalledOnce();
    });

    it("returns error when seeding fails", async () => {
      vi.mocked(seedConnections).mockRejectedValueOnce(new Error("fail"));
      const result = await seedService.seedConnections();
      expect(result).toEqual({ success: false, error: "fail" });
    });
  });

  describe("seedProviders", () => {
    it("returns success when seeding succeeds", async () => {
      const result = await seedService.seedProviders();
      expect(result).toEqual({ success: true, message: "Providers seeded successfully" });
      expect(seedProvidersData).toHaveBeenCalledOnce();
    });

    it("returns error when seeding fails", async () => {
      vi.mocked(seedProvidersData).mockRejectedValueOnce(new Error("fail"));
      const result = await seedService.seedProviders();
      expect(result).toEqual({ success: false, error: "fail" });
    });
  });

  describe("seedSpaces", () => {
    it("returns success when seeding succeeds", async () => {
      const result = await seedService.seedSpaces();
      expect(result).toEqual({ success: true, message: "Spaces seeded successfully" });
      expect(seedSpacesData).toHaveBeenCalledOnce();
    });

    it("returns error when seeding fails", async () => {
      vi.mocked(seedSpacesData).mockRejectedValueOnce(new Error("fail"));
      const result = await seedService.seedSpaces();
      expect(result).toEqual({ success: false, error: "fail" });
    });
  });

  describe("seedAll", () => {
    it("calls all seed functions in order and returns success", async () => {
      const result = await seedService.seedAll();
      expect(result).toEqual({ success: true, message: "All data seeded successfully" });
      expect(seedAccountsData).toHaveBeenCalledOnce();
      expect(seedApps).toHaveBeenCalledOnce();
      expect(seedConnections).toHaveBeenCalledOnce();
      expect(seedProvidersData).toHaveBeenCalledOnce();
      expect(seedSpacesData).toHaveBeenCalledOnce();
    });

    it("returns error if any seed function fails", async () => {
      vi.mocked(seedConnections).mockRejectedValueOnce(new Error("conn fail"));
      const result = await seedService.seedAll();
      expect(result).toEqual({ success: false, error: "conn fail" });
    });

    it("converts non-Error throws to string", async () => {
      vi.mocked(seedAccountsData).mockRejectedValueOnce("raw string error");
      const result = await seedService.seedAll();
      expect(result).toEqual({ success: false, error: "raw string error" });
    });
  });
});
