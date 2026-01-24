import { seedProviders } from "../data/providers";
import { providers } from "../schema";
import { getDb, initializeDatabase } from "../client";

export async function seedProvidersData(): Promise<void> {
  // Ensure DB is initialized (uses Electron userData path by default)
  await initializeDatabase();

  const db = getDb();

  for (const provider of seedProviders) {
    const providerData = {
      id: provider.id,
      kind: provider.kind,
      displayName: provider.displayName,
      isEnabled: provider.isEnabled ?? true,
      config: provider.config ? JSON.stringify(provider.config) : null,
      capabilities: provider.capabilities ? JSON.stringify(provider.capabilities) : null,
      defaultModel: provider.defaultModel ?? null,
    };

    // drizzle-orm/better-sqlite3 is synchronous
    db.insert(providers).values(providerData).onConflictDoNothing().run?.();
  }
}

// Optional: allow running this file directly in dev
if (process.argv[1]?.includes("seed-providers")) {
  seedProvidersData()
    .then(() => {
      console.log("\nProviders seeding completed successfully!");
    })
    .catch((error) => {
      console.error("\nProviders seeding failed:", error);
      process.exitCode = 1;
    });
}
