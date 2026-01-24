import { seedService } from "./seed.service";
import type { ServiceResponse } from "./seed.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const seedController = {
  async seedApps(): Promise<ServiceResponse> {
    return seedService.seedApps();
  },

  async seedConnections(): Promise<ServiceResponse> {
    return seedService.seedConnections();
  },

  async seedProviders(): Promise<ServiceResponse> {
    return seedService.seedProviders();
  },

  async seedAll(): Promise<ServiceResponse> {
    return seedService.seedAll();
  },
};
