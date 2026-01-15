import { ipcMain } from "electron";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { appSettings, accounts } from "../db/schema";

const ACCOUNT_ID = "default";
const SETTINGS_ID = "default";

type AppSettingsRecord = typeof appSettings.$inferSelect;

async function ensureAppSettingsRow(): Promise<AppSettingsRecord> {
  const db = getDb();
  
  const existing = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });

  if (existing) {
    return existing;
  }

  // Create default settings
  await db
    .insert(appSettings)
    .values({ 
      id: SETTINGS_ID, 
      accountId: ACCOUNT_ID,
    })
    .onConflictDoNothing();

  const created = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });

  if (!created) {
    throw new Error("Failed to create app settings");
  }

  return created;
}

export function registerAppSettingsHandlers() {
  // Get app settings
  ipcMain.handle("appSettings:get", async () => {
    try {
      const settings = await ensureAppSettingsRow();
      return { success: true, data: settings };
    } catch (error) {
      console.error("Error fetching app settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Update active mood
  ipcMain.handle("appSettings:setActiveMood", async (_event, moodId: string | null) => {
    try {
      const db = getDb();
      await ensureAppSettingsRow();

      await db
        .update(appSettings)
        .set({ 
          activeMoodId: moodId,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(appSettings.id, SETTINGS_ID));

      const updated = await db.query.appSettings.findFirst({
        where: eq(appSettings.id, SETTINGS_ID),
      });

      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating active mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  console.log("App settings handlers registered");
}
