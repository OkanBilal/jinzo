// IPC
export { registerAppsIpc, unregisterAppsIpc } from "./apps.ipc";

// Controller
export { appsController } from "./apps.controller";

// Service
export { appsService } from "./apps.service";

// Repository
export { appsRepo } from "./apps.repo";

// Validation
export { validateAppId, validateUpdatePayload, type ValidationResult } from "./apps.validation";

// DTOs
export type {
  AppRecord,
  AppResponse,
  UpdateAppRequest,
  ServiceResponse,
  SuccessResponse,
  ErrorResponse,
} from "./apps.dto";
