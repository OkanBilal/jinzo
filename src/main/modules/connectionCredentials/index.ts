// IPC Handlers
export {
  registerConnectionCredentialsIpc,
  unregisterConnectionCredentialsIpc,
} from "./connectionCredentials.ipc";

// Controller
export { connectionCredentialsController } from "./connectionCredentials.controller";

// Service
export { connectionCredentialsService } from "./connectionCredentials.service";

// Repository
export { connectionCredentialsRepo } from "./connectionCredentials.repo";

// Utils
export {
  encryptToken,
  createTokenHash,
  parseConnectionMetadata,
  parseProviderCredentials,
} from "./connectionCredentials.utils";

// DTOs
export type {
  SaveCredentialsPayload,
  CredentialsCheckResult,
  ParsedCredentials,
  SaveCredentialsResult,
  ServiceResponse,
  SuccessResponse,
  ErrorResponse,
} from "./connectionCredentials.dto";
