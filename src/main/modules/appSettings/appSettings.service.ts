import { ACCOUNT_ID, SETTINGS_ID } from "./appSettings.constants";
import { appSettingsRepo } from "./appSettings.repo";
import { validateMoodId } from "./appSettings.validation";
import type { AppSettingsRecord, ServiceResponse } from "./appSettings.dto";

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
// ─────────────────────────────────────────────────────────────
export const appSettingsService = {
  /**
   * Ensures the default settings row exists
   */
  async ensureSettings(): Promise<AppSettingsRecord> {
    const existing = await appSettingsRepo.findById(SETTINGS_ID);
    if (existing) return existing;

    // Ensure default account exists first (foreign key constraint)
    await appSettingsRepo.createDefaultAccount();

    // Create default settings
    await appSettingsRepo.create({
      id: SETTINGS_ID,
      accountId: ACCOUNT_ID,
    });

    const created = await appSettingsRepo.findById(SETTINGS_ID);
    if (!created) {
      throw new Error("Failed to create app settings");
    }

    return created;
  },

  /**
   * Gets the current app settings
   */
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

  /**
   * Sets the active mood
   */
  async setActiveMood(moodId: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    try {
      const { value, error } = validateMoodId(moodId);
      if (error) {
        return { success: false, error };
      }

      await this.ensureSettings();

      const updated = await appSettingsRepo.updateActiveMood(SETTINGS_ID, value);
      if (!updated) {
        return { success: false, error: "Failed to update settings" };
      }

      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating active mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async setEnableWorktrees(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    try {
      if (typeof enabled !== "boolean") {
        return { success: false, error: "enabled must be a boolean" };
      }

      await this.ensureSettings();

      const updated = await appSettingsRepo.updateEnableWorktrees(SETTINGS_ID, enabled);
      if (!updated) {
        return { success: false, error: "Failed to update settings" };
      }

      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating enableWorktrees:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async setShowToolCalls(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    try {
      if (typeof enabled !== "boolean") {
        return { success: false, error: "enabled must be a boolean" };
      }

      await this.ensureSettings();

      const updated = await appSettingsRepo.updateShowToolCalls(SETTINGS_ID, enabled);
      if (!updated) {
        return { success: false, error: "Failed to update settings" };
      }

      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating showToolCalls:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async setPreventSleepDuringRuns(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    try {
      if (typeof enabled !== "boolean") {
        return { success: false, error: "enabled must be a boolean" };
      }

      await this.ensureSettings();

      const updated = await appSettingsRepo.updatePreventSleepDuringRuns(SETTINGS_ID, enabled);
      if (!updated) {
        return { success: false, error: "Failed to update settings" };
      }

      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating preventSleepDuringRuns:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async setNotifyOnRunComplete(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    try {
      if (typeof enabled !== "boolean") {
        return { success: false, error: "enabled must be a boolean" };
      }

      await this.ensureSettings();

      const updated = await appSettingsRepo.updateNotifyOnRunComplete(SETTINGS_ID, enabled);
      if (!updated) {
        return { success: false, error: "Failed to update settings" };
      }

      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating notifyOnRunComplete:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async setNotifyOnToolApproval(enabled: unknown): Promise<ServiceResponse<AppSettingsRecord>> {
    try {
      if (typeof enabled !== "boolean") {
        return { success: false, error: "enabled must be a boolean" };
      }

      await this.ensureSettings();

      const updated = await appSettingsRepo.updateNotifyOnToolApproval(SETTINGS_ID, enabled);
      if (!updated) {
        return { success: false, error: "Failed to update settings" };
      }

      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating notifyOnToolApproval:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
