import { syncService } from "./sync.service";
import type { SyncJobResult, ServiceResponse } from "./sync.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const syncController = {
  async runEntitySync(provider?: string): Promise<ServiceResponse<SyncJobResult>> {
    return syncService.runEntitySync(provider);
  },
};
