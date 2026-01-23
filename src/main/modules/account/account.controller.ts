import { accountService } from "./account.service";
import type { ServiceResponse, AccountResponse } from "./account.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const accountController = {
  async get(): Promise<ServiceResponse<AccountResponse>> {
    return accountService.getAccount();
  },

  async update(payload: unknown): Promise<ServiceResponse<AccountResponse>> {
    return accountService.updateAccount(payload);
  },
};
