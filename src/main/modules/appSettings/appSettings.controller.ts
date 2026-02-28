import { appSettingsService } from "./appSettings.service";
import type { AppSettingsRecord, ServiceResponse } from "./appSettings.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const appSettingsController = {
  async get(): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.getSettings();
  },

  async setActiveSpace(spaceId: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setActiveSpace(spaceId);
  },

  async setEnableWorktrees(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setEnableWorktrees(enabled);
  },

  async setShowToolCalls(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setShowToolCalls(enabled);
  },

  async setPreventSleepDuringRuns(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setPreventSleepDuringRuns(enabled);
  },

  async setNotifyOnRunComplete(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setNotifyOnRunComplete(enabled);
  },

  async setNotifyOnToolApproval(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setNotifyOnToolApproval(enabled);
  },

  async setCommitInstructions(instructions: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setCommitInstructions(instructions);
  },

  async setPrInstructions(instructions: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    return appSettingsService.setPrInstructions(instructions);
  },
};
