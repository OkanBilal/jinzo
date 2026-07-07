import { ACCOUNT_ID, SETTINGS_ID } from "./appSettings.constants";
import { appSettingsRepo } from "./appSettings.repo";
import { sanitizeAppSettingsPatch } from "./appSettings.validation";
import type { AppSettingsRecord } from "./appSettings.dto";

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
//
// Throw-style: methods return plain values and throw on failure; the
// ServiceResponse envelope is applied by handle() at the IPC seam.
// See CONTEXT.md "handle".
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

  async getSettings(): Promise<AppSettingsRecord> {
    return this.ensureSettings();
  },

  async updateSettings(patch: unknown): Promise<AppSettingsRecord> {
    const sanitized = sanitizeAppSettingsPatch(patch);
    if (!sanitized) {
      throw new Error("patch must be an object");
    }

    await this.ensureSettings();
    const updated = await appSettingsRepo.update(SETTINGS_ID, sanitized);
    if (!updated) {
      throw new Error("Failed to update settings");
    }
    return updated;
  },
};
