import { ACCOUNT_ID } from "./account.constants";
import { accountRepo } from "./account.repo";
import { validateUpdatePayload } from "./account.validation";
import {
  formatAccountResponse,
  type AccountRecord,
  type AccountResponse,
  type ServiceResponse,
} from "./account.dto";

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
// ─────────────────────────────────────────────────────────────
export const accountService = {
  /**
   * Ensures the default account row exists
   */
  async ensureAccount(): Promise<AccountRecord> {
    const existing = await accountRepo.findById(ACCOUNT_ID);
    if (existing) return existing;

    await accountRepo.create({
      id: ACCOUNT_ID,
      timezone: "UTC",
      locale: "en-US",
    });

    const created = await accountRepo.findById(ACCOUNT_ID);
    if (!created) {
      throw new Error("Failed to initialize account row");
    }

    return created;
  },

  /**
   * Gets the current account
   */
  async getAccount(): Promise<ServiceResponse<AccountResponse>> {
    try {
      const account = await this.ensureAccount();
      return { success: true, data: formatAccountResponse(account) };
    } catch (error) {
      console.error("Failed to fetch account:", error);
      return { success: false, error: "Failed to fetch account" };
    }
  },

  /**
   * Updates the current account
   */
  async updateAccount(payload: unknown): Promise<ServiceResponse<AccountResponse>> {
    try {
      const { data, errors } = validateUpdatePayload(payload);

      if (Object.keys(errors).length > 0) {
        const message = Object.entries(errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join("; ");
        return { success: false, error: message };
      }

      if (Object.keys(data).length === 0) {
        return { success: false, error: "No fields to update" };
      }

      await this.ensureAccount();

      const updated = await accountRepo.update(ACCOUNT_ID, data);

      return { success: true, data: formatAccountResponse(updated) };
    } catch (error) {
      console.error("Failed to update account:", error);
      return { success: false, error: "Failed to update account" };
    }
  },
};
