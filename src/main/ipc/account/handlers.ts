import { ipcMain } from "electron";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { accounts } from "../../db/schema";
import { ACCOUNT_ID } from "./constants";
import { ensureAccountRow, formatResponse, sanitizePayload } from "./utils";

/**
 * Register all IPC handlers for account operations
 */
export function registerAccountHandlers() {
  // Get account details
  ipcMain.handle("account:get", async () => {
    try {
      const account = await ensureAccountRow();
      return { success: true, data: formatResponse(account) };
    } catch (error) {
      console.error("Failed to fetch account:", error);
      return { success: false, error: "Failed to fetch account" };
    }
  });

  // Update account details
  ipcMain.handle("account:update", async (_, payload: unknown) => {
    try {
      const { data, errors } = sanitizePayload(payload);

      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      if (Object.keys(data).length === 0) {
        return { success: false, error: "No fields to update" };
      }

      await ensureAccountRow();

      const db = getDb();
      await db
        .update(accounts)
        .set({
          ...data,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(accounts.id, ACCOUNT_ID));

      const updated = await db.query.accounts.findFirst({
        where: eq(accounts.id, ACCOUNT_ID),
      });

      return { success: true, data: formatResponse(updated) };
    } catch (error) {
      console.error("Failed to update account:", error);
      return { success: false, error: "Failed to update account" };
    }
  });

  console.log("Account handlers registered");
}

export function unregisterAccountHandlers() {
  ipcMain.removeHandler("account:get");
  ipcMain.removeHandler("account:update");
}
