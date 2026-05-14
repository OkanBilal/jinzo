import { ACCOUNT_ID, SETTINGS_ID } from "./appSettings.constants";
import { appSettingsRepo } from "./appSettings.repo";
import { sanitizeAppSettingsPatch } from "./appSettings.validation";
import type { AppSettingsRecord, ServiceResponse } from "./appSettings.dto";

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
// ─────────────────────────────────────────────────────────────
export const appSettingsService = {
  async ensureSettings(): Promise<AppSettingsRecord> {
    const existing = await appSettingsRepo.findById(SETTINGS_ID);
    if (existing) return existing;

    await appSettingsRepo.createDefaultAccount();
    await appSettingsRepo.create({ id: SETTINGS_ID, accountId: ACCOUNT_ID });

    const created = await appSettingsRepo.findById(SETTINGS_ID);
    if (!created) {
      throw new Error("Failed to create app settings");
    }
    return created;
  },

  async getSettings(): Promise<ServiceResponse<AppSettingsRecord>> {
    try {
      const settings = await this.ensureSettings();
      return { success: true, data: settings };
    } catch (error) {
      console.error("Error fetching app settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async updateSettings(
    patch: unknown,
  ): Promise<ServiceResponse<AppSettingsRecord>> {
    try {
      const sanitized = sanitizeAppSettingsPatch(patch);
      if (!sanitized) {
        return { success: false, error: "patch must be an object" };
      }

      await this.ensureSettings();
      const updated = await appSettingsRepo.update(SETTINGS_ID, sanitized);
      if (!updated) {
        return { success: false, error: "Failed to update settings" };
      }
      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating app settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
