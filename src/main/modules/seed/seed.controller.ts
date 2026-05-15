import { seedService } from "./seed.service";
import type { ServiceResponse } from "./seed.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const seedController = {
  async seedAccounts(): Promise<ServiceResponse<string>> {
    return seedService.seedAccounts();
  },

  async seedConnectionStates(): Promise<ServiceResponse<string>> {
    return seedService.seedConnectionStates();
  },

  async seedConnections(): Promise<ServiceResponse<string>> {
    return seedService.seedConnections();
  },

  async seedProviders(): Promise<ServiceResponse<string>> {
    return seedService.seedProviders();
  },

  async seedSpaces(): Promise<ServiceResponse<string>> {
    return seedService.seedSpaces();
  },

  async seedAll(): Promise<ServiceResponse<string>> {
    return seedService.seedAll();
  },
};
