/**
 * Note: Avoid scheduling at 2:00-3:00 AM due to DST changes
 * See: https://www.endpointdev.com/blog/2013/04/avoid-200-and-300-am-cron-jobs/
 */

// IPC
export { registerSyncIpc, unregisterSyncIpc } from "./sync.ipc";

// Service
export { syncService } from "./sync.service";

// Repository
export { syncRepo } from "./sync.repo";

// Fetchers
export { fetchAllEntities } from "./sync.fetchers";

// Helpers
export {
  pickUrl,
  isValidUrl,
  sanitizeUrl,
  formatDuration,
} from "./sync.helpers";

// Connection Utils
export {
  getConnectionByProvider,
  getConnectionSecrets,
  getSelectedResources,
  getConnectionWithSecrets,
  normalizeLimit,
  normalizeDateToIso,
  safeJsonParse,
} from "./sync.connection-utils";

// DTOs
export type {
  SyncJobResult,
  SyncJobStats,
  EntityInput,
  EntityQueryParams,
  JSONValue,
  ServiceResponse,
} from "./sync.dto";

// Connections
export * from "./connections";
