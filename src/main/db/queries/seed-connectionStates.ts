import { connectionStatesData } from "../data/connectionStates";
import { connectionStates } from "../schema";
import { getDb } from "../client";

export async function seedConnectionStates(): Promise<void> {
  const db = getDb();

  for (const app of connectionStatesData) {
    const appData = {
      id: app.id,
      isConnected: false,
      connectionId: null,
      displayName: app.name,
      iconPath: app.imageSrc,
      category: app.category,
      sortOrder: connectionStatesData.indexOf(app),
      enabledFeatures: JSON.stringify([]),
      config: JSON.stringify({}),
    };

    // drizzle-orm/better-sqlite3 is synchronous
    db.insert(connectionStates).values(appData).onConflictDoNothing().run?.();
  }
}

// Optional: allow running this file directly in dev
if (process.argv[1]?.includes("seed-connectionStates")) {
  seedConnectionStates()
    .then(() => {
      console.log("\nSeeding completed successfully!");
    })
    .catch((error) => {
      console.error("\nSeeding failed:", error);
      process.exitCode = 1;
    });
}
