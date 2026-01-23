import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { connections, connectionTokens, appStates } from "../../db/schema";

// ─────────────────────────────────────────────────────────────
// Connection Credentials Repository
// ─────────────────────────────────────────────────────────────
export const connectionCredentialsRepo = {
  async findConnectionById(connectionId: string) {
    const db = getDb();
    return db.select().from(connections).where(eq(connections.id, connectionId)).get();
  },

  async findConnectionByProvider(provider: string) {
    const db = getDb();
    return db.query.connections.findFirst({
      where: eq(connections.provider, provider),
    });
  },

  async markTokensNotCurrent(connectionId: string): Promise<void> {
    const db = getDb();
    await db
      .update(connectionTokens)
      .set({ isCurrent: false })
      .where(eq(connectionTokens.connectionId, connectionId))
      .run();
  },

  async insertToken(data: {
    connectionId: string;
    accessTokenEnc: Buffer;
    refreshTokenEnc: Buffer | null;
    tokenType: string;
    expiresAt: Date | null;
    tokenHash: Buffer;
    keyVersion: number;
    isCurrent: boolean;
  }): Promise<void> {
    const db = getDb();
    await db.insert(connectionTokens).values(data);
  },

  async updateConnectionStatus(
    connectionId: string,
    status: "active" | "revoked" | "error" | "disabled",
    metadata: string
  ): Promise<void> {
    const db = getDb();
    await db
      .update(connections)
      .set({
        status,
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(connections.id, connectionId))
      .run();
  },

  async updateAppState(
    provider: string,
    connectionId: string,
    isConnected: boolean
  ): Promise<void> {
    const db = getDb();
    await db
      .update(appStates)
      .set({
        isConnected,
        connectionId,
        updatedAt: new Date(),
      })
      .where(eq(appStates.id, provider))
      .run();
  },

  async findTokensByConnectionId(connectionId: string) {
    const db = getDb();
    return db.query.connectionTokens.findMany({
      where: eq(connectionTokens.connectionId, connectionId),
    });
  },
};
