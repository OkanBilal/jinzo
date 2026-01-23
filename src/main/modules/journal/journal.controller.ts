import { journalService } from "./journal.service";
import type {
  CreateJournalDraftPayload,
  UpdateJournalDraftPayload,
  JournalQueryOptions,
  RevisionQueryOptions,
} from "./journal.dto";

// ─────────────────────────────────────────────────────────────
// Journal Controller - Maps IPC calls to service methods
// ─────────────────────────────────────────────────────────────
export const journalController = {
  async getAll(options: JournalQueryOptions = {}) {
    return journalService.getAll(options);
  },

  async getById(id: string) {
    return journalService.getById(id);
  },

  async createDraft(payload: CreateJournalDraftPayload) {
    return journalService.createDraft(payload);
  },

  async updateDraft(entityId: string, payload: UpdateJournalDraftPayload) {
    return journalService.updateDraft(entityId, payload);
  },

  async save(entityId: string) {
    return journalService.save(entityId);
  },

  async publish(entityId: string) {
    return journalService.publish(entityId);
  },

  async delete(entityId: string) {
    return journalService.delete(entityId);
  },

  async getRevisions(entityId: string, options: RevisionQueryOptions = {}) {
    return journalService.getRevisions(entityId, options);
  },

  async markForIndexing(entityId: string) {
    return journalService.markForIndexing(entityId);
  },

  setEditing(entityId: string | null) {
    return journalService.setEditing(entityId);
  },

  getEditing() {
    return journalService.getEditing();
  },

  async appendText(entityId: string, textToAppend: string) {
    return journalService.appendText(entityId, textToAppend);
  },
};
