// IPC Handlers
export { registerSpaceIpc, unregisterSpaceIpc } from "./space.ipc";

// Controller
export { spaceController } from "./space.controller";

// Service
export { spaceService } from "./space.service";

// Repository
export { spaceRepo } from "./space.repo";

// Validation
export { sanitizeSpacePayload, sanitizeString, generateSlug } from "./space.validation";

// Constants
export { ACCOUNT_ID } from "./space.constants";

// DTOs
export type {
  SpacePayload,
  SanitizedSpaceResult,
  SpaceRecord,
  ServiceResponse,
  SuccessResponse,
  ErrorResponse,
} from "./space.dto";
