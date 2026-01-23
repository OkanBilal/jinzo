import { v4 as uuidv4 } from "uuid";
import { journalRepo } from "./journal.repo";
import { JOURNAL_KIND, MAX_REVISIONS_PER_ENTITY, SAVE_RATE_LIMIT_MS } from "./journal.constants";
import {
  parseMetadata,
  serializeMetadata,
  computeWordCount,
  deriveSummary,
  createFeedEventSnapshot,
  getCurrentEditingJournalId,
  setCurrentEditingJournalId,
  getLastSaveEventTime,
  setLastSaveEventTime,
} from "./journal.utils";
import type {
  JournalEntry,
  JournalMetadata,
  CreateJournalDraftPayload,
  UpdateJournalDraftPayload,
  JournalQueryOptions,
  RevisionQueryOptions,
  DocumentRevision,
  ServiceResponse,
} from "./journal.dto";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function toJournalEntry(item: {
  id: string;
  accountId: string;
  title: string | null;
  body: string | null;
  summary: string | null;
  metadata: string | null;
  occurredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): JournalEntry {
  return {
    id: item.id,
    accountId: item.accountId,
    title: item.title,
    body: item.body,
    summary: item.summary,
    metadata: parseMetadata(item.metadata),
    occurredAt: item.occurredAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Journal Service
// ─────────────────────────────────────────────────────────────
export const journalService = {
  async getAll(options: JournalQueryOptions = {}): Promise<ServiceResponse<JournalEntry[]>> {
    try {
      const { limit = 50 } = options;
      const items = await journalRepo.findAll(limit);
      const journalEntries = items.map(toJournalEntry);
      return { success: true, data: journalEntries };
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async getById(id: string): Promise<ServiceResponse<JournalEntry | null>> {
    try {
      const item = await journalRepo.findById(id);
      if (!item) {
        return { success: true, data: null };
      }
      return { success: true, data: toJournalEntry(item) };
    } catch (error) {
      console.error("Error fetching journal entry:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async createDraft(payload: CreateJournalDraftPayload): Promise<ServiceResponse<JournalEntry>> {
    try {
      const entityId = uuidv4();
      const now = new Date();
      const title = payload.title || "Untitled";
      const metadata: JournalMetadata = {
        status: "draft",
        wordCount: computeWordCount(payload.body),
      };

      // Insert entity
      await journalRepo.create({
        id: entityId,
        accountId: payload.accountId,
        kind: JOURNAL_KIND,
        title,
        body: payload.body || "",
        summary: deriveSummary(payload.body),
        metadata: serializeMetadata(metadata),
        occurredAt: payload.occurredAt || now,
      });

      // Insert feed event
      await journalRepo.createFeedItem({
        accountId: payload.accountId,
        entityId,
        eventType: "journal.created",
        itemType: JOURNAL_KIND,
        title: `Draft created: ${title}`,
        snapshot: createFeedEventSnapshot("draft", metadata.wordCount || 0),
        occurredAt: now,
      });

      // Fetch and return the created entry
      const created = await journalRepo.findById(entityId);
      if (!created) {
        return { success: false, error: "Failed to create journal entry" };
      }

      return { success: true, data: toJournalEntry(created) };
    } catch (error) {
      console.error("Error creating journal draft:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async updateDraft(
    entityId: string,
    payload: UpdateJournalDraftPayload
  ): Promise<ServiceResponse<JournalEntry>> {
    try {
      const currentEntry = await journalRepo.findById(entityId);
      if (!currentEntry) {
        return { success: false, error: "Journal entry not found" };
      }

      const currentMetadata = parseMetadata(currentEntry.metadata);

      // Compute derived fields
      const body = payload.body ?? currentEntry.body;
      const derivedSummary = deriveSummary(body);
      const wordCount = computeWordCount(body);

      // Merge metadata
      const newMetadata: JournalMetadata = {
        ...currentMetadata,
        ...payload.metadata,
        wordCount,
      };

      // Update only the entity
      await journalRepo.update(entityId, {
        title: payload.title !== undefined ? payload.title : currentEntry.title,
        body,
        summary: payload.summary ?? derivedSummary,
        metadata: serializeMetadata(newMetadata),
        updatedAt: new Date(),
      });

      // Fetch and return updated entry
      const updated = await journalRepo.findById(entityId);
      if (!updated) {
        return { success: false, error: "Failed to update journal entry" };
      }

      return { success: true, data: toJournalEntry(updated) };
    } catch (error) {
      console.error("Error updating journal draft:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async save(entityId: string): Promise<ServiceResponse<JournalEntry>> {
    try {
      const entry = await journalRepo.findById(entityId);
      if (!entry) {
        return { success: false, error: "Journal entry not found" };
      }

      const metadata = parseMetadata(entry.metadata);
      const now = new Date();

      // Rate limit check for save events
      const lastSaveTime = getLastSaveEventTime(entityId);
      const timeSinceLastSave = now.getTime() - lastSaveTime;
      const shouldCreateFeedEvent = timeSinceLastSave >= SAVE_RATE_LIMIT_MS;

      // Create revision
      await journalRepo.createRevision({
        entityId,
        title: entry.title,
        body: entry.body,
        wordCount: metadata.wordCount || 0,
      });

      // Clean up old revisions
      const revisionCount = await journalRepo.getRevisionCount(entityId);
      if (revisionCount > MAX_REVISIONS_PER_ENTITY) {
        const oldRevisions = await journalRepo.getOldestRevisions(
          entityId,
          revisionCount - MAX_REVISIONS_PER_ENTITY
        );
        for (const rev of oldRevisions) {
          await journalRepo.deleteRevision(rev.id);
        }
      }

      // Create feed event (rate limited)
      if (shouldCreateFeedEvent) {
        await journalRepo.createFeedItem({
          accountId: entry.accountId,
          entityId,
          eventType: "journal.saved",
          itemType: JOURNAL_KIND,
          title: `Saved: ${entry.title || "Untitled"}`,
          snapshot: createFeedEventSnapshot(
            metadata.status,
            metadata.wordCount || 0,
            entry.body?.length || 0
          ),
          occurredAt: now,
        });
        setLastSaveEventTime(entityId, now.getTime());
      }

      // Update entity timestamp
      await journalRepo.update(entityId, { updatedAt: now });

      // Fetch and return updated entry
      const updated = await journalRepo.findById(entityId);
      if (!updated) {
        return { success: false, error: "Failed to save journal entry" };
      }

      return { success: true, data: toJournalEntry(updated) };
    } catch (error) {
      console.error("Error saving journal:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async publish(entityId: string): Promise<ServiceResponse<JournalEntry>> {
    try {
      const entry = await journalRepo.findById(entityId);
      if (!entry) {
        return { success: false, error: "Journal entry not found" };
      }

      const currentMetadata = parseMetadata(entry.metadata);
      const now = new Date();

      // Update metadata to published
      const newMetadata: JournalMetadata = {
        ...currentMetadata,
        status: "published",
      };

      // Update entity
      await journalRepo.update(entityId, {
        metadata: serializeMetadata(newMetadata),
        updatedAt: now,
      });

      // Create feed event
      await journalRepo.createFeedItem({
        accountId: entry.accountId,
        entityId,
        eventType: "journal.published",
        itemType: JOURNAL_KIND,
        title: `Published: ${entry.title || "Untitled"}`,
        snapshot: createFeedEventSnapshot(
          "published",
          newMetadata.wordCount || 0,
          entry.body?.length || 0
        ),
        occurredAt: now,
      });

      // Fetch and return updated entry
      const updated = await journalRepo.findById(entityId);
      if (!updated) {
        return { success: false, error: "Failed to publish journal entry" };
      }

      return { success: true, data: toJournalEntry(updated) };
    } catch (error) {
      console.error("Error publishing journal:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async delete(entityId: string): Promise<ServiceResponse<void>> {
    try {
      await journalRepo.softDelete(entityId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error("Error deleting journal:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async getRevisions(
    entityId: string,
    options: RevisionQueryOptions = {}
  ): Promise<ServiceResponse<DocumentRevision[]>> {
    try {
      const { limit = 20 } = options;
      const revisions = await journalRepo.findRevisions(entityId, limit);
      return { success: true, data: revisions };
    } catch (error) {
      console.error("Error fetching revisions:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async markForIndexing(entityId: string): Promise<ServiceResponse<void>> {
    try {
      const current = await journalRepo.findById(entityId);
      if (!current) {
        return { success: false, error: "Entity not found" };
      }

      const currentMetadata = parseMetadata(current.metadata);
      const now = Date.now();

      // Only mark for indexing if enough time has passed since last index
      const lastIndexed = currentMetadata.lastIndexedAt || 0;
      const indexThresholdMs = 30000; // 30 seconds

      if (now - lastIndexed > indexThresholdMs) {
        const newMetadata = {
          ...currentMetadata,
          lastIndexedAt: now,
        };
        await journalRepo.updateMetadata(entityId, serializeMetadata(newMetadata));
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error("Error marking for indexing:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  setEditing(entityId: string | null): ServiceResponse<void> {
    setCurrentEditingJournalId(entityId);
    return { success: true, data: undefined };
  },

  getEditing(): ServiceResponse<string | null> {
    return { success: true, data: getCurrentEditingJournalId() };
  },

  async appendText(entityId: string, textToAppend: string): Promise<ServiceResponse<JournalEntry>> {
    try {
      const currentEntry = await journalRepo.findById(entityId);
      if (!currentEntry) {
        return { success: false, error: "Journal entry not found" };
      }

      const currentBody = currentEntry.body || "";

      // Append the text with proper spacing
      const separator = currentBody.endsWith("\n") || currentBody === "" ? "" : "\n\n";
      const newBody = currentBody + separator + textToAppend;

      // Update metadata
      const currentMetadata = parseMetadata(currentEntry.metadata);
      const newMetadata: JournalMetadata = {
        ...currentMetadata,
        wordCount: computeWordCount(newBody),
      };

      // Update the entity
      await journalRepo.update(entityId, {
        body: newBody,
        summary: deriveSummary(newBody),
        metadata: serializeMetadata(newMetadata),
        updatedAt: new Date(),
      });

      // Fetch and return updated entry
      const updated = await journalRepo.findById(entityId);
      if (!updated) {
        return { success: false, error: "Failed to append to journal entry" };
      }

      return { success: true, data: toJournalEntry(updated) };
    } catch (error) {
      console.error("Error appending to journal:", error);
      return { success: false, error: (error as Error).message };
    }
  },
};

// Re-export for MCP tools compatibility
export { getCurrentEditingJournalId, setCurrentEditingJournalId };
