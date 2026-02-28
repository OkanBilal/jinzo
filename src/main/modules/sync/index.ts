/**
 * Note: Avoid scheduling at 2:00-3:00 AM due to DST changes
 * See: https://www.endpointdev.com/blog/2013/04/avoid-200-and-300-am-cron-jobs/
 */

// IPC
export { registerSyncIpc, unregisterSyncIpc } from "./sync.ipc";

// Controller
export { syncController } from "./sync.controller";

// Service
export { syncService } from "./sync.service";

// Repository
export { syncRepo } from "./sync.repo";

// Fetchers
export { fetchAllEntities } from "./sync.fetchers";

// Chunking
export {
  createChunksForEntities,
  createEntityChunkMap,
  generateChunkEmbeddings,
} from "./sync.chunking";

// Helpers
export {
  extractImageFromHtml,
  pickUrl,
  isValidUrl,
  sanitizeUrl,
  formatDuration,
} from "./sync.helpers";

// Connection Utils
export {
  decryptToken,
  getConnectionByProvider,
  getConnectionTokens,
  getSelectedResources,
  getConnectionWithTokens,
  normalizeLimit,
  normalizeDateToIso,
  safeJsonParse,
} from "./sync.connection-utils";

// DTOs
export type {
  ChunkData,
  ItemChunkInfo,
  SyncJobResult,
  SyncJobStats,
  EntityInput,
  EntityQueryParams,
  JSONValue,
  FeedItem,
  ServiceResponse,
  SuccessResponse,
  ErrorResponse,
} from "./sync.dto";

export { feedItemToEntityInput } from "./sync.dto";

// Connections
export * from "./connections";
