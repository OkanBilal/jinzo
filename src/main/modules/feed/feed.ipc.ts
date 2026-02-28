import { ipcMain } from "electron";
import { feedController } from "./feed.controller";
import type { FeedQueryOptions } from "./feed.dto";

// ─────────────────────────────────────────────────────────────
// Feed IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerFeedIpc() {
  // Get feed events with optional filters and pagination
  ipcMain.handle("feed:getEvents", async (_, options?: FeedQueryOptions) => {
    return feedController.getEvents(options || {});
  });

  // Get feed event by ID
  ipcMain.handle("feed:getEventById", async (_, id: number) => {
    return feedController.getEventById(id);
  });

  // Get events for a specific entity
  ipcMain.handle("feed:getEventsByEntity", async (_, entityId: string) => {
    return feedController.getEventsByEntity(entityId);
  });

}

export function unregisterFeedIpc() {
  ipcMain.removeHandler("feed:getEvents");
  ipcMain.removeHandler("feed:getEventById");
  ipcMain.removeHandler("feed:getEventsByEntity");
}
