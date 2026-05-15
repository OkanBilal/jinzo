// IPC
export { registerAccountIpc, unregisterAccountIpc } from "./account.ipc";

// Controller
export { accountController } from "./account.controller";

// Service
export { accountService } from "./account.service";

// Repository
export { accountRepo } from "./account.repo";

// Validation
export { validateUpdatePayload, type ValidationResult } from "./account.validation";

// DTOs
export {
  formatAccountResponse,
  DEFAULT_ACCOUNT,
  type AccountRecord,
  type AccountResponse,
  type UpdateAccountRequest,
  type ServiceResponse,
} from "./account.dto";

// Constants
export { ACCOUNT_ID, FIELD_LIMITS } from "./account.constants";
