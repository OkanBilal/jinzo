import { apps } from "../data/apps";

import { appStates } from "../schema";
import { getDb } from "../client";

export async function seedApps(): Promise<void> {
  const db = getDb();

  for (const app of apps) {
    const appData = {
      id: app.id,
      isConnected: false,
      connectionId: null,
      displayName: app.name,
      iconPath: app.imageSrc,
      category: app.category,
      sortOrder: apps.indexOf(app),
      enabledFeatures: JSON.stringify([]),
      config: JSON.stringify({}),
    };

    // drizzle-orm/better-sqlite3 is synchronous
    db.insert(appStates).values(appData).onConflictDoNothing().run?.();
  }
}

// Optional: allow running this file directly in dev
if (process.argv[1]?.includes("seed-apps")) {
  seedApps()
    .then(() => {
      console.log("\nSeeding completed successfully!");
    })
    .catch((error) => {
      console.error("\nSeeding failed:", error);
      process.exitCode = 1;
    });
}
