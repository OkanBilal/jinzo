import { eq, sql, desc } from "drizzle-orm";
import { getDb } from "../../db/client";
import { appStates } from "../../db/schema";
import type { AppResponse, UpdateAppRequest } from "./apps.dto";

// ─────────────────────────────────────────────────────────────
// Repository - Drizzle queries
// ─────────────────────────────────────────────────────────────
export const appsRepo = {
  async findAll(): Promise<AppResponse[]> {
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

    return apps;
  },

  async updateById(id: string, data: UpdateAppRequest): Promise<void> {
    const db = getDb();
    await db
      .update(appStates)
      .set({
        isConnected: data.isConnected,
        connectionId: data.connectionId || null,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appStates.id, id));
  },
};
