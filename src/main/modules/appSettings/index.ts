// IPC
export { registerAppSettingsIpc, unregisterAppSettingsIpc } from "./appSettings.ipc";

// Controller
export { appSettingsController } from "./appSettings.controller";

// Service
export { appSettingsService } from "./appSettings.service";

// Repository
export { appSettingsRepo } from "./appSettings.repo";

// Validation
export { validateSpaceId } from "./appSettings.validation";

// DTOs
export type {
  AppSettingsRecord,
  SetActiveSpaceRequest,
  ServiceResponse,
  SuccessResponse,
  ErrorResponse,
} from "./appSettings.dto";

// Constants
export { ACCOUNT_ID, SETTINGS_ID } from "./appSettings.constants";
