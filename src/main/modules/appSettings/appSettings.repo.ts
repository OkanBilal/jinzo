import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { appSettings, accounts } from "../../db/schema";
import { ACCOUNT_ID } from "./appSettings.constants";
import type { AppSettingsRecord } from "./appSettings.dto";

// ─────────────────────────────────────────────────────────────
// Repository - Drizzle queries
// ─────────────────────────────────────────────────────────────
export const appSettingsRepo = {
  async findById(id: string): Promise<AppSettingsRecord | null> {
    const db = getDb();
    const result = await db.query.appSettings.findFirst({
      where: eq(appSettings.id, id),
    });
    return result ?? null;
  },

  async createDefaultAccount(): Promise<void> {
    const db = getDb();
    const existing = await db.query.accounts.findFirst({
      where: eq(accounts.id, ACCOUNT_ID),
    });

    if (!existing) {
      await db.insert(accounts).values({ id: ACCOUNT_ID }).onConflictDoNothing();
    }
  },

  async create(data: { id: string; accountId: string }): Promise<void> {
    const db = getDb();
    await db.insert(appSettings).values(data).onConflictDoNothing();
  },

  async updateActiveSpace(id: string, spaceId: string | null): Promise<AppSettingsRecord | null> {
    const db = getDb();
    await db
      .update(appSettings)
      .set({
        activeSpaceId: spaceId,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, id));

    return this.findById(id);
  },

  async updateEnableWorktrees(id: string, enabled: boolean): Promise<AppSettingsRecord | null> {
    const db = getDb();
    await db
      .update(appSettings)
      .set({
        enableWorktrees: enabled,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, id));

    return this.findById(id);
  },

  async updateShowToolCalls(id: string, enabled: boolean): Promise<AppSettingsRecord | null> {
    const db = getDb();
    await db
      .update(appSettings)
      .set({
        showToolCalls: enabled,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, id));

    return this.findById(id);
  },

  async updatePreventSleepDuringRuns(id: string, enabled: boolean): Promise<AppSettingsRecord | null> {
    const db = getDb();
    await db
      .update(appSettings)
      .set({
        preventSleepDuringRuns: enabled,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, id));

    return this.findById(id);
  },

  async updateNotifyOnRunComplete(id: string, enabled: boolean): Promise<AppSettingsRecord | null> {
    const db = getDb();
    await db
      .update(appSettings)
      .set({
        notifyOnRunComplete: enabled,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, id));

    return this.findById(id);
  },

  async updateNotifyOnToolApproval(id: string, enabled: boolean): Promise<AppSettingsRecord | null> {
    const db = getDb();
    await db
      .update(appSettings)
      .set({
        notifyOnToolApproval: enabled,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, id));

    return this.findById(id);
  },

  async updateCommitInstructions(id: string, instructions: string): Promise<AppSettingsRecord | null> {
    const db = getDb();
    await db
      .update(appSettings)
      .set({
        commitInstructions: instructions,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, id));

    return this.findById(id);
  },

  async updatePrInstructions(id: string, instructions: string): Promise<AppSettingsRecord | null> {
    const db = getDb();
    await db
      .update(appSettings)
      .set({
        prInstructions: instructions,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, id));

    return this.findById(id);
  },
};
