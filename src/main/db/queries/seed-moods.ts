import { sql } from "drizzle-orm";
import { seedMoods } from "../data/moods";
import { moods, appSettings } from "../schema";
import { getDb } from "../client";

const ACCOUNT_ID = "default";
const DEFAULT_ACTIVE_MOOD_ID = "claude";

export async function seedMoodsData(): Promise<void> {
  console.log("[seedMoodsData] Starting mood seeding...");
  console.log("[seedMoodsData] Number of moods to seed:", seedMoods.length);

  const db = getDb();

  for (const mood of seedMoods) {
    console.log(`[seedMoodsData] Seeding mood: ${mood.id}`);

    const moodData = {
      id: mood.id,
      accountId: ACCOUNT_ID,
      name: mood.name,
      slug: mood.slug,
      description: null,
      systemPrompt: mood.systemPrompt || null,
      model: null,
      icon: mood.icon || null,
      themeConfig: JSON.stringify(mood.themeConfig),
      uiConfig: JSON.stringify(mood.uiConfig),
      sortOrder: mood.sortOrder,
    };

    // drizzle-orm/better-sqlite3 is synchronous
    const result = db.insert(moods).values(moodData).onConflictDoNothing().run?.();
    console.log(`[seedMoodsData] Insert result for ${mood.id}:`, result);
  }

  // Ensure app_settings row exists with default active mood
  console.log(`[seedMoodsData] Setting default active mood to: ${DEFAULT_ACTIVE_MOOD_ID}`);
  db.insert(appSettings)
    .values({
      id: "default",
      accountId: ACCOUNT_ID,
      activeMoodId: DEFAULT_ACTIVE_MOOD_ID,
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        activeMoodId: DEFAULT_ACTIVE_MOOD_ID,
        updatedAt: sql`(unixepoch())`,
      },
    })
    .run?.();

  console.log("[seedMoodsData] Mood seeding completed");
}

// Optional: allow running this file directly in dev
if (process.argv[1]?.includes("seed-moods")) {
  seedMoodsData()
    .then(() => {
      console.log("\nMoods seeding completed successfully!");
    })
    .catch((error) => {
      console.error("\nMoods seeding failed:", error);
      process.exitCode = 1;
    });
}
