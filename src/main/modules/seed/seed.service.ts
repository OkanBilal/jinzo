import { ok } from "../../../shared/ipc-kit/service-response";
import { seedAccountsData } from "../../db/queries/seed-accounts";
import { seedConnectionStates } from "../../db/queries/seed-connectionStates";
import { seedConnections } from "../../db/queries/seed-connections";
import { seedProvidersData } from "../../db/queries/seed-providers";
import { seedSpacesData } from "../../db/queries/seed-spaces";
import type { ServiceResponse } from "./seed.dto";

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
// ─────────────────────────────────────────────────────────────
export const seedService = {
  async seedAccounts(): Promise<ServiceResponse<string>> {
    try {
      await seedAccountsData();
      return ok("Accounts seeded successfully");
    } catch (error) {
      console.error("Error seeding accounts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async seedConnectionStates(): Promise<ServiceResponse<string>> {
    try {
      await seedConnectionStates();
      return ok("Connections States seeded successfully");
    } catch (error) {
      console.error("Error seeding connection states:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async seedConnections(): Promise<ServiceResponse<string>> {
    try {
      await seedConnections();
      return ok("Connections States seeded successfully");
    } catch (error) {
      console.error("Error seeding connections:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async seedProviders(): Promise<ServiceResponse<string>> {
    try {
      await seedProvidersData();
      return ok("Providers seeded successfully");
    } catch (error) {
      console.error("Error seeding providers:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },


  async seedSpaces(): Promise<ServiceResponse<string>> {
    try {
      await seedSpacesData();
      return ok("Spaces seeded successfully");
    } catch (error) {
      console.error("Error seeding spaces:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async seedAll(): Promise<ServiceResponse<string>> {
    try {
      await seedAccountsData(); // MUST be first
      await seedConnectionStates();
      await seedConnections();
      await seedProvidersData();
      await seedSpacesData();
      return ok("All data seeded successfully");
    } catch (error) {
      console.error("Error seeding data:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
