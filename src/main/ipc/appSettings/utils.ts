import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { appSettings, accounts } from "../../db/schema";
import { ACCOUNT_ID, SETTINGS_ID } from "./constants";
import type { AppSettingsRecord } from "./types";

export async function ensureDefaultAccount(): Promise<void> {
  const db = getDb();
  
  const existing = await db.query.accounts.findFirst({
    where: eq(accounts.id, ACCOUNT_ID),
  });

  if (!existing) {
    await db
      .insert(accounts)
      .values({ id: ACCOUNT_ID })
      .onConflictDoNothing();
  }
}

export async function ensureAppSettingsRow(): Promise<AppSettingsRecord> {
  const db = getDb();
  
  const existing = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });

  if (existing) {
    return existing;
  }

  // Ensure default account exists first (foreign key constraint)
  await ensureDefaultAccount();

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
