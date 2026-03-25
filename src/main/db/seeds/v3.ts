// ─────────────────────────────────────────────────────────────
// Seed v3 — Update Codex space/provider to match current data,
//           update app categories
// ─────────────────────────────────────────────────────────────

import { eq, sql } from "drizzle-orm";
import { appStates, providers, spaces } from "../schema";
import { seedProviders } from "../data/providers";
import { seedSpaces } from "../data/spaces";
import { apps } from "../data/apps";
import type { DatabaseInstance } from "../types";

export async function run(db: DatabaseInstance): Promise<void> {
  // 1. Update Codex space with current data
  const codexSpace = seedSpaces.find((s) => s.id === "codex");
  if (codexSpace) {
    db.update(spaces)
      .set({
        icon: codexSpace.icon,
        themeConfig: JSON.stringify(codexSpace.themeConfig),
        uiConfig: JSON.stringify(codexSpace.uiConfig),
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(spaces.id, "codex"))
      .run();
  }

  // 2. Update Codex provider with current data
  const codexProvider = seedProviders.find((p) => p.id === "codex");
  if (codexProvider) {
    db.update(providers)
      .set({
        displayName: codexProvider.displayName,
        defaultModel: codexProvider.defaultModel ?? null,
        config: codexProvider.config ? JSON.stringify(codexProvider.config) : null,
        capabilities: codexProvider.capabilities
          ? JSON.stringify(codexProvider.capabilities)
          : null,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(providers.id, "codex"))
      .run();
  }

  // 3. Update app categories and names
  for (const app of apps) {
    db.update(appStates)
      .set({
        displayName: app.name,
        category: app.category,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appStates.id, app.id))
      .run();
  }
}
