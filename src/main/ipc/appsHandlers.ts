import { ipcMain } from "electron";
import { eq, sql, desc } from "drizzle-orm";
import { getDb } from "../db/client";
import { appStates } from "../db/schema";

/**
 * Register all IPC handlers for apps operations
 */
export function registerAppsHandlers() {
  // Get all apps
  ipcMain.handle("apps:getAll", async () => {
    try {
      const db = getDb();
      const apps = await db
        .select({
          id: appStates.id,
          displayName: appStates.displayName,
          iconPath: appStates.iconPath,
          isConnected: appStates.isConnected,
          connectionId: appStates.connectionId,
          highlighted: appStates.highlighted,
          sortOrder: appStates.sortOrder,
          enabledFeatures: appStates.enabledFeatures,
          config: appStates.config,
        })
        .from(appStates)
        .orderBy(desc(appStates.highlighted), appStates.sortOrder);

      return { success: true, data: apps };
    } catch (error) {
      console.error("Error fetching apps:", error);
      return { success: false, error: "Failed to fetch apps" };
    }
  });

  // Update app state by ID
  ipcMain.handle("apps:updateById", async (_, id: string, payload: { isConnected: boolean; connectionId?: string | null }) => {
    try {
      if (!id || typeof id !== "string") {
        return { success: false, error: "Invalid app ID" };
      }

      const { isConnected, connectionId } = payload;

      if (typeof isConnected !== "boolean") {
        return { success: false, error: "isConnected must be a boolean" };
      }

      const db = getDb();
      await db
        .update(appStates)
        .set({
          isConnected: isConnected,
          connectionId: connectionId || null,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(appStates.id, id));

      return { success: true };
    } catch (error) {
      console.error("Error updating app state:", error);
      return { success: false, error: "Failed to update app state" };
    }
  });
}
