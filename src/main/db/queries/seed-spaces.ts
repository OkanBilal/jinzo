import { sql } from "drizzle-orm";
import { spaces, appSettings } from "../schema";
import { getDb } from "../client";
import { seedSpaces } from "../data/spaces";

const ACCOUNT_ID = "default";
const DEFAULT_ACTIVE_SPACE_ID = "claude";

export async function seedSpacesData(): Promise<void> {
  console.log("[seedSpacesData] Starting space seeding...");
  console.log("[seedSpacesData] Number of spaces to seed:", seedSpaces.length);

  const db = getDb();

  for (const space of seedSpaces) {
    console.log(`[seedSpacesData] Seeding space: ${space.id}`);

    const spaceData = {
      id: space.id,
      accountId: ACCOUNT_ID,
      name: space.name,
      slug: space.slug,
      description: null,
      systemPrompt: space.systemPrompt || null,
      model: null,
      icon: space.icon || null,
      themeConfig: JSON.stringify(space.themeConfig),
      uiConfig: JSON.stringify(space.uiConfig),
      sortOrder: space.sortOrder,
    };

    // drizzle-orm/better-sqlite3 is synchronous
    const result = db.insert(spaces).values(spaceData).onConflictDoNothing().run?.();
    console.log(`[seedSpacesData] Insert result for ${space.id}:`, result);
  }

  // Ensure app_settings row exists with default active space
  console.log(`[seedSpacesData] Setting default active space to: ${DEFAULT_ACTIVE_SPACE_ID}`);
  db.insert(appSettings)
    .values({
      id: "default",
      accountId: ACCOUNT_ID,
      activeSpaceId: DEFAULT_ACTIVE_SPACE_ID,
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        activeSpaceId: DEFAULT_ACTIVE_SPACE_ID,
        updatedAt: sql`(unixepoch())`,
      },
    })
    .run?.();

  console.log("[seedSpacesData] Space seeding completed");
}

// Optional: allow running this file directly in dev
if (process.argv[1]?.includes("seed-spaces")) {
  seedSpacesData()
    .then(() => {
      console.log("\nSpaces seeding completed successfully!");
    })
    .catch((error) => {
      console.error("\nSpaces seeding failed:", error);
      process.exitCode = 1;
    });
}
