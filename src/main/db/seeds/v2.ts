// ─────────────────────────────────────────────────────────────
// Seed v2 — Add Socket.dev connection state + connection row
// ─────────────────────────────────────────────────────────────

import { eq } from "drizzle-orm";
import { connectionStates, connections } from "../schema";
import type { DatabaseInstance } from "../types";

export async function run(db: DatabaseInstance): Promise<void> {
  // 1. Connection state
  db.insert(connectionStates)
    .values({
      id: "socketdev",
      isConnected: false,
      connectionId: null,
      displayName: "Socket",
      iconPath: "connections/socketdev.png",
      category: "monitoring",
      sortOrder: 7,
      enabledFeatures: JSON.stringify([]),
      config: JSON.stringify({ description: "Supply chain security and package health" }),
    })
    .onConflictDoNothing()
    .run?.();

  // 2. Connection row
  const existing = await db.query.connections.findFirst({
    where: eq(connections.provider, "socketdev"),
  });
  if (!existing) {
    const id = `c${Date.now().toString(36)}${Array.from({ length: 16 }, () => Math.random().toString(36).charAt(2)).join("")}`.slice(0, 24);
    await db.insert(connections).values({
      id,
      provider: "socketdev",
      type: "api_key",
      displayName: "Socket",
      status: "revoked",
      scopes: JSON.stringify([]),
      metadata: JSON.stringify(null),
    });
  }
}
