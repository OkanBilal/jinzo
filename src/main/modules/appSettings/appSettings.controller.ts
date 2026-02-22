import { appSettingsService } from "./appSettings.service";
import type { AppSettingsRecord, ServiceResponse } from "./appSettings.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const appSettingsController = {
  async get(): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.getSettings();
  },

  async setActiveMood(moodId: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setActiveMood(moodId);
  },

  async setEnableWorktrees(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setEnableWorktrees(enabled);
  },

  async setShowToolCalls(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setShowToolCalls(enabled);
  },
};
