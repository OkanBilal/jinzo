import { eq, sql, desc } from "drizzle-orm";
import { getDb } from "../../db/client";
import { connectionStates } from "../../db/schema";
import type { ConnectionStatesResponse, UpdateConnectionStatesRequest } from "./connectionStates.dto";

// ─────────────────────────────────────────────────────────────
// Repository - Drizzle queries
// ─────────────────────────────────────────────────────────────
export const connectionStatesRepo = {
  async findAll(): Promise<ConnectionStatesResponse[]> {
    const db = getDb();
    const connections = await db
      .select({
        id: connectionStates.id,
        displayName: connectionStates.displayName,
        iconPath: connectionStates.iconPath,
        isConnected: connectionStates.isConnected,
        connectionId: connectionStates.connectionId,
        category: connectionStates.category,
        sortOrder: connectionStates.sortOrder,
        enabledFeatures: connectionStates.enabledFeatures,
        config: connectionStates.config,
      })
      .from(connectionStates)
      .orderBy(desc(connectionStates.sortOrder));

    return connections;
  },

  async updateById(id: string, data: UpdateConnectionStatesRequest): Promise<void> {
    const db = getDb();
    await db
      .update(connectionStates)
      .set({
        isConnected: data.isConnected,
        connectionId: data.connectionId || null,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(connectionStates.id, id));
  },
};
