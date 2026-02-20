import { updatesService } from "./updates.service";
import type { ServiceResponse, UpdateState } from "./updates.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const updatesController = {
  async checkForUpdates(): Promise<ServiceResponse<UpdateState>> {
    return updatesService.checkForUpdates();
  },

  async downloadUpdate(): Promise<ServiceResponse<UpdateState>> {
    return updatesService.downloadUpdate();
  },

  quitAndInstall(): ServiceResponse<null> {
    return updatesService.quitAndInstall();
  },

  getStatus(): ServiceResponse<UpdateState> {
    return updatesService.getStatus();
  },
};
