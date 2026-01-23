// IPC Handlers
export { registerJournalIpc, unregisterJournalIpc } from "./journal.ipc";

// Controller
export { journalController } from "./journal.controller";

// Service
export {
  journalService,
  getCurrentEditingJournalId,
  setCurrentEditingJournalId,
} from "./journal.service";

// Repository
export { journalRepo } from "./journal.repo";

// Utils
export {
  parseMetadata,
  serializeMetadata,
  computeWordCount,
  deriveSummary,
  createFeedEventSnapshot,
  getLastSaveEventTime,
  setLastSaveEventTime,
} from "./journal.utils";

// Constants
export {
  JOURNAL_KIND,
  MAX_REVISIONS_PER_ENTITY,
  SAVE_RATE_LIMIT_MS,
} from "./journal.constants";

// DTOs
export type {
  JournalMetadata,
  JournalEntry,
  CreateJournalDraftPayload,
  UpdateJournalDraftPayload,
  FeedEventSnapshot,
  JournalQueryOptions,
  RevisionQueryOptions,
  DocumentRevision,
  ServiceResponse,
  SuccessResponse,
  ErrorResponse,
} from "./journal.dto";
