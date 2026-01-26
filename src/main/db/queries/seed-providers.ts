import { seedProviders } from "../data/providers";
import { providers } from "../schema";
import { getDb } from "../client";

export async function seedProvidersData(): Promise<void> {
  console.log("[seedProvidersData] Starting provider seeding...");
  console.log("[seedProvidersData] Number of providers to seed:", seedProviders.length);
  
  const db = getDb();

  for (const provider of seedProviders) {
    console.log(`[seedProvidersData] Seeding provider: ${provider.id}`);
    
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
    const result = db.insert(providers).values(providerData).onConflictDoNothing().run?.();
    console.log(`[seedProvidersData] Insert result for ${provider.id}:`, result);
  }
  
  console.log("[seedProvidersData] Provider seeding completed");
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
