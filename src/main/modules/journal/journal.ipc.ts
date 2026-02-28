import { ipcMain } from "electron";
import { journalController } from "./journal.controller";
import type {
  CreateJournalDraftPayload,
  UpdateJournalDraftPayload,
  JournalQueryOptions,
  RevisionQueryOptions,
} from "./journal.dto";

// ─────────────────────────────────────────────────────────────
// Journal IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerJournalIpc() {
  // Get all journal entries
  ipcMain.handle(
    "journal:getAll",
    async (_, options: JournalQueryOptions = {}) => {
      return journalController.getAll(options);
    }
  );

  // Get journal entry by ID
  ipcMain.handle("journal:getById", async (_, id: string) => {
    return journalController.getById(id);
  });

  // Create a new journal draft
  ipcMain.handle(
    "journal:createDraft",
    async (_, payload: CreateJournalDraftPayload) => {
      return journalController.createDraft(payload);
    }
  );

  // Update journal draft (autosave)
  ipcMain.handle(
    "journal:updateDraft",
    async (_, entityId: string, payload: UpdateJournalDraftPayload) => {
      return journalController.updateDraft(entityId, payload);
    }
  );

  // Save journal (creates feed event + revision)
  ipcMain.handle("journal:save", async (_, entityId: string) => {
    return journalController.save(entityId);
  });

  // Publish journal
  ipcMain.handle("journal:publish", async (_, entityId: string) => {
    return journalController.publish(entityId);
  });

  // Delete journal entry (soft delete)
  ipcMain.handle("journal:delete", async (_, entityId: string) => {
    return journalController.delete(entityId);
  });

  // Get revisions for a journal entry
  ipcMain.handle(
    "journal:getRevisions",
    async (_, entityId: string, options: RevisionQueryOptions = {}) => {
      return journalController.getRevisions(entityId, options);
    }
  );

  // Mark entity as needing indexing (for RAG)
  ipcMain.handle("journal:markForIndexing", async (_, entityId: string) => {
    return journalController.markForIndexing(entityId);
  });

  // Set currently editing journal
  ipcMain.handle("journal:setEditing", async (_, entityId: string | null) => {
    return journalController.setEditing(entityId);
  });

  // Get currently editing journal ID
  ipcMain.handle("journal:getEditing", async () => {
    return journalController.getEditing();
  });

  // Append text to journal (used by MCP tools)
  ipcMain.handle(
    "journal:appendText",
    async (_, entityId: string, textToAppend: string) => {
      return journalController.appendText(entityId, textToAppend);
    }
  );

}

export function unregisterJournalIpc() {
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
}
