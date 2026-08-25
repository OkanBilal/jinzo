import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { pairedDevices } from "../../db/schema";
import type { PairedDeviceRecord, PairedDevicePlatform } from "./backend.dto";

// ─────────────────────────────────────────────────────────────
// Repository - Drizzle queries (paired_devices; the backend id itself lives
// on app_settings and is written through appSettingsService)
// ─────────────────────────────────────────────────────────────
export const backendRepo = {
  async insertPairedDevice(data: {
    id: string;
    name: string;
    platform: PairedDevicePlatform;
    appVersion: string | null;
    tokenHash: string;
  }): Promise<void> {
    const db = getDb();
    await db.insert(pairedDevices).values(data);
  },

  /** The device a token hash belongs to, unless it has been revoked. */
  async findActivePairedDeviceByTokenHash(
    tokenHash: string,
  ): Promise<PairedDeviceRecord | null> {
    const db = getDb();
    const result = await db.query.pairedDevices.findFirst({
      where: and(
        eq(pairedDevices.tokenHash, tokenHash),
        isNull(pairedDevices.revokedAt),
      ),
    });
    return result ?? null;
  },

  async listActivePairedDevices(): Promise<PairedDeviceRecord[]> {
    const db = getDb();
    return db.query.pairedDevices.findMany({
      where: isNull(pairedDevices.revokedAt),
      orderBy: [desc(pairedDevices.createdAt)],
    });
  },

  async touchPairedDeviceLastSeen(id: string): Promise<void> {
    const db = getDb();
    await db
      .update(pairedDevices)
      .set({ lastSeenAt: sql`(unixepoch())` })
      .where(eq(pairedDevices.id, id));
  },

  /** Revoke an active device. Returns false when no active row matched. */
  async revokePairedDevice(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .update(pairedDevices)
      .set({ revokedAt: sql`(unixepoch())` })
      .where(and(eq(pairedDevices.id, id), isNull(pairedDevices.revokedAt)));
    return result.changes > 0;
  },
};
