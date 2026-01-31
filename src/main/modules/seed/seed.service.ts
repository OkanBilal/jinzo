import { seedAccountsData } from "../../db/queries/seed-accounts";
import { seedApps } from "../../db/queries/seed-apps";
import { seedConnections } from "../../db/queries/seed-connections";
import { seedProvidersData } from "../../db/queries/seed-providers";
import type { ServiceResponse } from "./seed.dto";

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
// ─────────────────────────────────────────────────────────────
export const seedService = {
  async seedAccounts(): Promise<ServiceResponse> {
    try {
      await seedAccountsData();
      return { success: true, message: "Accounts seeded successfully" };
    } catch (error) {
      console.error("Error seeding accounts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async seedApps(): Promise<ServiceResponse> {
    try {
      await seedApps();
      return { success: true, message: "Apps seeded successfully" };
    } catch (error) {
      console.error("Error seeding apps:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async seedConnections(): Promise<ServiceResponse> {
    try {
      await seedConnections();
      return { success: true, message: "Connections seeded successfully" };
    } catch (error) {
      console.error("Error seeding connections:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async seedProviders(): Promise<ServiceResponse> {
    try {
      await seedProvidersData();
      return { success: true, message: "Providers seeded successfully" };
    } catch (error) {
      console.error("Error seeding providers:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },


  async seedAll(): Promise<ServiceResponse> {
    try {
      await seedAccountsData(); // MUST be first
      await seedApps();
      await seedConnections();
      await seedProvidersData();
      return { success: true, message: "All data seeded successfully" };
    } catch (error) {
      console.error("Error seeding data:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
