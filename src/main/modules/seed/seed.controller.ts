import { seedService } from "./seed.service";
import type { ServiceResponse } from "./seed.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const seedController = {
  async seedAccounts(): Promise<ServiceResponse> {
    return seedService.seedAccounts();
  },

  async seedApps(): Promise<ServiceResponse> {
    return seedService.seedApps();
  },

  async seedConnections(): Promise<ServiceResponse> {
    return seedService.seedConnections();
  },

  async seedProviders(): Promise<ServiceResponse> {
    return seedService.seedProviders();
  },

  async seedSpaces(): Promise<ServiceResponse> {
    return seedService.seedSpaces();
  },

  async seedAll(): Promise<ServiceResponse> {
    return seedService.seedAll();
  },
};
