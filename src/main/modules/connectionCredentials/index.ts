// IPC Handlers
export {
  registerConnectionCredentialsIpc,
  unregisterConnectionCredentialsIpc,
} from "./connectionCredentials.ipc";

// Service
export { connectionCredentialsService } from "./connectionCredentials.service";

// Repository
export { connectionCredentialsRepo } from "./connectionCredentials.repo";

// Utils
export {
  encryptSecrets,
  decryptSecrets,
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
} from "./connectionCredentials.dto";
