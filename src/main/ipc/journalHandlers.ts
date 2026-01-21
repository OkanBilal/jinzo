import { ipcMain } from "electron";
import { desc, eq, and, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { entities, feedItems, documentRevisions } from "../db/schema";
import { v4 as uuidv4 } from "uuid";

// ==================== TYPES ====================

export interface JournalMetadata {
  status: "draft" | "published";
  wordCount?: number;
  lastIndexedAt?: number;
}

export interface JournalEntry {
  id: string;
  accountId: string;
  title: string | null;
  body: string | null;
  summary: string | null;
  metadata: JournalMetadata;
  occurredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateJournalDraftPayload {
  accountId: string;
  title?: string;
  body?: string;
  occurredAt?: Date;
}

interface UpdateJournalDraftPayload {
  title?: string;
  body?: string;
  summary?: string;
  metadata?: Partial<JournalMetadata>;
}

interface FeedEventSnapshot {
  status: string;
  wordCount: number;
  chars?: number;
}

// ==================== HELPER FUNCTIONS ====================

const JOURNAL_KIND = "journal_entry";
const MAX_REVISIONS_PER_ENTITY = 50;
const SAVE_RATE_LIMIT_MS = 30000; // 30 seconds rate limit for save events

// Track last save event time per entity for rate limiting
const lastSaveEventTime = new Map<string, number>();

// Track currently editing journal for MCP tools
let currentEditingJournalId: string | null = null;

export function getCurrentEditingJournalId(): string | null {
  return currentEditingJournalId;
}

export function setCurrentEditingJournalId(id: string | null): void {
  currentEditingJournalId = id;
}

function serializeMetadata(metadata: JournalMetadata): string {
  return JSON.stringify(metadata);
}

function parseMetadata(metadataStr: string | null): JournalMetadata {
  if (!metadataStr) {
    return { status: "draft", wordCount: 0 };
  }
  try {
    return JSON.parse(metadataStr) as JournalMetadata;
  } catch {
    return { status: "draft", wordCount: 0 };
  }
}

function computeWordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}


function deriveSummary(body: string | null | undefined): string {
  if (!body) return "";

  // Simple markdown stripping - remove common markdown syntax
  const text = body
    .replace(/^#+\s*/gm, "") // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/__([^_]+)__/g, "$1") // bold underscores
    .replace(/_([^_]+)_/g, "$1") // italic underscores
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // images
    .replace(/^[-*+]\s+/gm, "") // list items
    .replace(/^\d+\.\s+/gm, "") // numbered lists
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/\n{2,}/g, " ") // multiple newlines
    .replace(/\n/g, " ") // single newlines
    .trim();

  // Return first 280-500 chars, preferring to break at sentence/word boundary
  if (text.length <= 280) return text;

  const maxLen = 500;
  if (text.length <= maxLen) return text;

  // Find a good break point
  let breakPoint = maxLen;
  const sentenceEnd = text.lastIndexOf(".", maxLen);
  if (sentenceEnd > 200) {
    breakPoint = sentenceEnd + 1;
  } else {
    const spaceIndex = text.lastIndexOf(" ", maxLen);
    if (spaceIndex > 200) {
      breakPoint = spaceIndex;
    }
  }

  return text.slice(0, breakPoint).trim() + (breakPoint < text.length ? "..." : "");
}

function createFeedEventSnapshot(
  status: string,
  wordCount: number,
  includeChars?: number
): string {
  const snapshot: FeedEventSnapshot = { status, wordCount };
  if (includeChars !== undefined) {
    snapshot.chars = includeChars;
  }
  return JSON.stringify(snapshot);
}

// ==================== REGISTER HANDLERS ====================

export function registerJournalHandlers() {
  // Get all journal entries
  ipcMain.handle(
    "journal:getAll",
    async (_, options: { limit?: number } = {}) => {
      try {
        const db = getDb();
        const { limit = 50 } = options;

        const items = await db
          .select()
          .from(entities)
          .where(
            and(
              eq(entities.kind, JOURNAL_KIND),
              eq(entities.isDeleted, false)
            )
          )
          .orderBy(desc(entities.updatedAt))
          .limit(limit);

        const journalEntries: JournalEntry[] = items.map((item) => ({
          id: item.id,
          accountId: item.accountId,
          title: item.title,
          body: item.body,
          summary: item.summary,
          metadata: parseMetadata(item.metadata),
          occurredAt: item.occurredAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));

        return { success: true, data: journalEntries };
      } catch (error) {
        console.error("Error fetching journal entries:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Get journal entry by ID
  ipcMain.handle("journal:getById", async (_, id: string) => {
    try {
      const db = getDb();
      const items = await db
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.id, id),
            eq(entities.kind, JOURNAL_KIND)
          )
        )
        .limit(1);

      if (!items[0]) {
        return { success: true, data: null };
      }

      const item = items[0];
      const journalEntry: JournalEntry = {
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

      return { success: true, data: journalEntry };
    } catch (error) {
      console.error("Error fetching journal entry:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Create a new journal draft (with feed event in transaction)
  ipcMain.handle(
    "journal:createDraft",
    async (_, payload: CreateJournalDraftPayload) => {
      try {
        const db = getDb();
        const entityId = uuidv4();
        const now = new Date();
        const title = payload.title || "Untitled";
        const metadata: JournalMetadata = {
          status: "draft",
          wordCount: computeWordCount(payload.body),
        };

        // Insert entity
        await db.insert(entities).values({
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
        await db.insert(feedItems).values({
          accountId: payload.accountId,
          entityId,
          eventType: "journal.created",
          itemType: JOURNAL_KIND,
          title: `Draft created: ${title}`,
          snapshot: createFeedEventSnapshot("draft", metadata.wordCount || 0),
          occurredAt: now,
        });

        // Fetch and return the created entry
        const created = await db
          .select()
          .from(entities)
          .where(eq(entities.id, entityId))
          .limit(1);

        const item = created[0]!;
        const journalEntry: JournalEntry = {
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

        return { success: true, data: journalEntry };
      } catch (error) {
        console.error("Error creating journal draft:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Update journal draft (autosave - NO feed event)
  ipcMain.handle(
    "journal:updateDraft",
    async (_, entityId: string, payload: UpdateJournalDraftPayload) => {
      try {
        const db = getDb();

        // Fetch current entry to merge metadata
        const current = await db
          .select()
          .from(entities)
          .where(
            and(
              eq(entities.id, entityId),
              eq(entities.kind, JOURNAL_KIND)
            )
          )
          .limit(1);

        if (!current[0]) {
          return { success: false, error: "Journal entry not found" };
        }

        const currentEntry = current[0];
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
        // Title is only updated if explicitly provided, otherwise keep current title
        await db
          .update(entities)
          .set({
            title: payload.title !== undefined ? payload.title : currentEntry.title,
            body,
            summary: payload.summary ?? derivedSummary,
            metadata: serializeMetadata(newMetadata),
            updatedAt: new Date(),
          })
          .where(eq(entities.id, entityId));

        // Fetch and return updated entry
        const updated = await db
          .select()
          .from(entities)
          .where(eq(entities.id, entityId))
          .limit(1);

        const item = updated[0]!;
        const journalEntry: JournalEntry = {
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

        return { success: true, data: journalEntry };
      } catch (error) {
        console.error("Error updating journal draft:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Save journal (creates feed event + optional revision)
  ipcMain.handle("journal:save", async (_, entityId: string) => {
    try {
      const db = getDb();

      // Fetch current entry
      const current = await db
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.id, entityId),
            eq(entities.kind, JOURNAL_KIND)
          )
        )
        .limit(1);

      if (!current[0]) {
        return { success: false, error: "Journal entry not found" };
      }

      const entry = current[0];
      const metadata = parseMetadata(entry.metadata);
      const now = new Date();

      // Rate limit check for save events
      const lastSaveTime = lastSaveEventTime.get(entityId) || 0;
      const timeSinceLastSave = now.getTime() - lastSaveTime;
      const shouldCreateFeedEvent = timeSinceLastSave >= SAVE_RATE_LIMIT_MS;

      // Create revision
      await db.insert(documentRevisions).values({
        entityId,
        title: entry.title,
        body: entry.body,
        wordCount: metadata.wordCount || 0,
      });

      // Clean up old revisions (keep last MAX_REVISIONS_PER_ENTITY)
      const revisionCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(documentRevisions)
        .where(eq(documentRevisions.entityId, entityId));

      const count = revisionCount[0]?.count || 0;
      if (count > MAX_REVISIONS_PER_ENTITY) {
        // Get the ID of the Nth oldest revision
        const oldRevisions = await db
          .select({ id: documentRevisions.id })
          .from(documentRevisions)
          .where(eq(documentRevisions.entityId, entityId))
          .orderBy(documentRevisions.createdAt)
          .limit(count - MAX_REVISIONS_PER_ENTITY);

        for (const rev of oldRevisions) {
          await db.delete(documentRevisions)
            .where(eq(documentRevisions.id, rev.id));
        }
      }

      // Create feed event (rate limited)
      if (shouldCreateFeedEvent) {
        await db.insert(feedItems).values({
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
        lastSaveEventTime.set(entityId, now.getTime());
      }

      // Update entity timestamp
      await db.update(entities)
        .set({ updatedAt: now })
        .where(eq(entities.id, entityId));

      // Fetch and return updated entry
      const updated = await db
        .select()
        .from(entities)
        .where(eq(entities.id, entityId))
        .limit(1);

      const item = updated[0]!;
      const journalEntry: JournalEntry = {
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

      return { success: true, data: journalEntry };
    } catch (error) {
      console.error("Error saving journal:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Publish journal
  ipcMain.handle("journal:publish", async (_, entityId: string) => {
    try {
      const db = getDb();

      // Fetch current entry
      const current = await db
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.id, entityId),
            eq(entities.kind, JOURNAL_KIND)
          )
        )
        .limit(1);

      if (!current[0]) {
        return { success: false, error: "Journal entry not found" };
      }

      const entry = current[0];
      const currentMetadata = parseMetadata(entry.metadata);
      const now = new Date();

      // Update metadata to published
      const newMetadata: JournalMetadata = {
        ...currentMetadata,
        status: "published",
      };

      // Update entity
      await db.update(entities)
        .set({
          metadata: serializeMetadata(newMetadata),
          updatedAt: now,
        })
        .where(eq(entities.id, entityId));

      // Create feed event
      await db.insert(feedItems).values({
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
      const updated = await db
        .select()
        .from(entities)
        .where(eq(entities.id, entityId))
        .limit(1);

      const item = updated[0]!;
      const journalEntry: JournalEntry = {
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

      return { success: true, data: journalEntry };
    } catch (error) {
      console.error("Error publishing journal:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Delete journal entry (soft delete)
  ipcMain.handle("journal:delete", async (_, entityId: string) => {
    try {
      const db = getDb();

      await db
        .update(entities)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(
          and(
            eq(entities.id, entityId),
            eq(entities.kind, JOURNAL_KIND)
          )
        );

      return { success: true };
    } catch (error) {
      console.error("Error deleting journal:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get revisions for a journal entry
  ipcMain.handle(
    "journal:getRevisions",
    async (_, entityId: string, options: { limit?: number } = {}) => {
      try {
        const db = getDb();
        const { limit = 20 } = options;

        const revisions = await db
          .select()
          .from(documentRevisions)
          .where(eq(documentRevisions.entityId, entityId))
          .orderBy(desc(documentRevisions.createdAt))
          .limit(limit);

        return { success: true, data: revisions };
      } catch (error) {
        console.error("Error fetching revisions:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Mark entity as needing indexing (for RAG)
  ipcMain.handle(
    "journal:markForIndexing",
    async (_, entityId: string) => {
      try {
        const db = getDb();

        // Fetch current entry
        const current = await db
          .select()
          .from(entities)
          .where(eq(entities.id, entityId))
          .limit(1);

        if (!current[0]) {
          return { success: false, error: "Entity not found" };
        }

        const currentMetadata = parseMetadata(current[0].metadata);
        const now = Date.now();

        // Only mark for indexing if enough time has passed since last index
        const lastIndexed = currentMetadata.lastIndexedAt || 0;
        const indexThresholdMs = 30000; // 30 seconds

        if (now - lastIndexed > indexThresholdMs) {
          const newMetadata = {
            ...currentMetadata,
            lastIndexedAt: now,
          };

          await db
            .update(entities)
            .set({ metadata: serializeMetadata(newMetadata) })
            .where(eq(entities.id, entityId));
        }

        return { success: true };
      } catch (error) {
        console.error("Error marking for indexing:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Set currently editing journal (called by renderer when opening a journal)
  ipcMain.handle("journal:setEditing", async (_, entityId: string | null) => {
    setCurrentEditingJournalId(entityId);
    return { success: true };
  });

  // Get currently editing journal ID
  ipcMain.handle("journal:getEditing", async () => {
    return { success: true, data: getCurrentEditingJournalId() };
  });

  // Append text to journal (used by MCP tools)
  ipcMain.handle(
    "journal:appendText",
    async (_, entityId: string, textToAppend: string) => {
      try {
        const db = getDb();

        // Fetch current entry
        const current = await db
          .select()
          .from(entities)
          .where(
            and(
              eq(entities.id, entityId),
              eq(entities.kind, JOURNAL_KIND)
            )
          )
          .limit(1);

        if (!current[0]) {
          return { success: false, error: "Journal entry not found" };
        }

        const currentEntry = current[0];
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
        await db
          .update(entities)
          .set({
            body: newBody,
            summary: deriveSummary(newBody),
            metadata: serializeMetadata(newMetadata),
            updatedAt: new Date(),
          })
          .where(eq(entities.id, entityId));

        // Fetch and return updated entry
        const updated = await db
          .select()
          .from(entities)
          .where(eq(entities.id, entityId))
          .limit(1);

        const item = updated[0]!;
        const journalEntry: JournalEntry = {
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

        return { success: true, data: journalEntry };
      } catch (error) {
        console.error("Error appending to journal:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  console.log("Journal IPC handlers registered");
}

export function unregisterJournalHandlers() {
  ipcMain.removeHandler("journal:getAll");
  ipcMain.removeHandler("journal:getById");
  ipcMain.removeHandler("journal:createDraft");
  ipcMain.removeHandler("journal:updateDraft");
  ipcMain.removeHandler("journal:save");
  ipcMain.removeHandler("journal:publish");
  ipcMain.removeHandler("journal:delete");
  ipcMain.removeHandler("journal:getRevisions");
  ipcMain.removeHandler("journal:markForIndexing");
  ipcMain.removeHandler("journal:setEditing");
  ipcMain.removeHandler("journal:getEditing");
  ipcMain.removeHandler("journal:appendText");
  console.log("Journal IPC handlers unregistered");
}
