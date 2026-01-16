import { eq, and } from "drizzle-orm";

import { getDb } from "../../../main/db/client";
import { connections, connectionTokens, connectionResources } from "../../../main/db/schema";

export function decryptToken(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

export async function getConnectionByProvider(
  provider: string
): Promise<{ id: string; metadata?: any } | null> {
  try {
    const db = getDb();
    const connection = db
      .select()
      .from(connections)
      .where(eq(connections.provider, provider))
      .get();

    if (!connection) {
      console.warn(`No ${provider} connection found`);
      return null;
    }

    const metadata = connection.metadata ? JSON.parse(connection.metadata) : {};
    
    return {
      id: connection.id,
      metadata,
    };
  } catch (error) {
    console.error(`Error getting ${provider} connection:`, error);
    return null;
  }
}

export async function getConnectionTokens(
  connectionId: string
): Promise<{ accessToken?: string; refreshToken?: string } | null> {
  try {
    const db = getDb();
    const token = db
      .select()
      .from(connectionTokens)
      .where(
        and(
          eq(connectionTokens.connectionId, connectionId),
          eq(connectionTokens.isCurrent, true)
        )
      )
      .get();

    if (!token) {
      console.warn(`No active token found for connection ${connectionId}`);
      return null;
    }

    return {
      accessToken: token.accessTokenEnc
        ? decryptToken(token.accessTokenEnc as Buffer)
        : undefined,
      refreshToken: token.refreshTokenEnc
        ? decryptToken(token.refreshTokenEnc as Buffer)
        : undefined,
    };
  } catch (error) {
    console.error("Error getting connection tokens:", error);
    return null;
  }
}

export async function getSelectedResources(
  connectionId: string,
  kind?: string
): Promise<Array<{
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  kind: string;
  metadata: any;
}>> {
  try {
    const db = getDb();
    const whereConditions = [
      eq(connectionResources.connectionId, connectionId),
      eq(connectionResources.selected, true),
    ];

    if (kind) {
      whereConditions.push(eq(connectionResources.kind, kind));
    }

    const resources = db
      .select()
      .from(connectionResources)
      .where(and(...whereConditions))
      .all();

    return resources.map((r) => ({
      id: r.id,
      connectionId: r.connectionId,
      externalId: r.externalId,
      name: r.name || "Untitled",
      kind: r.kind,
      metadata: r.metadata ? JSON.parse(r.metadata) : {},
    }));
  } catch (error) {
    console.error("Error getting selected resources:", error);
    return [];
  }
}

export async function getConnectionWithTokens(
  provider: string
): Promise<{
  id: string;
  accessToken?: string;
  refreshToken?: string;
  metadata?: any;
} | null> {
  const connection = await getConnectionByProvider(provider);
  if (!connection) return null;

  const tokens = await getConnectionTokens(connection.id);
  if (!tokens) return null;

  return {
    id: connection.id,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    metadata: connection.metadata,
  };
}

export function normalizeLimit(
  limit: number,
  min: number = 1,
  max: number = 100
): number {
  return Math.max(min, Math.min(max, limit));
}

export function normalizeDateToIso(date?: string | number | Date): string {
  if (!date) return new Date().toISOString();
  
  if (typeof date === "number") {
    return new Date(date * 1000).toISOString();
  }
  
  return new Date(date).toISOString();
}

export function safeJsonParse<T = any>(json: string | null, fallback: T = {} as T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
