// ─────────────────────────────────────────────────────────────
// Seed v4 — Update space theme lightBackground values
// ─────────────────────────────────────────────────────────────

import { eq, sql } from "drizzle-orm";
import { spaces } from "../schema";
import { seedSpaces } from "../data/spaces";
import type { DatabaseInstance } from "../types";

export async function run(db: DatabaseInstance): Promise<void> {
  for (const space of seedSpaces) {
    db.update(spaces)
      .set({
        themeConfig: JSON.stringify(space.themeConfig),
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(spaces.id, space.id))
      .run();
  }
}
