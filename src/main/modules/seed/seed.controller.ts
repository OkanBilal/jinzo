import { seedService } from "./seed.service";
import type { ServiceResponse } from "./seed.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const seedController = {
  async seedAccounts(): Promise<ServiceResponse> {
    return seedService.seedAccounts();
  },

  async seedConnectionStates(): Promise<ServiceResponse> {
    return seedService.seedConnectionStates();
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
