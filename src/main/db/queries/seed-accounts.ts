import { seedAccounts } from "../data/accounts";
import { accounts } from "../schema";
import { getDb } from "../client";

export async function seedAccountsData(): Promise<void> {
  console.log("[seedAccountsData] Starting account seeding...");
  console.log("[seedAccountsData] Number of accounts to seed:", seedAccounts.length);
  
  const db = getDb();

  for (const account of seedAccounts) {
    console.log(`[seedAccountsData] Seeding account: ${account.id}`);
    
    // drizzle-orm/better-sqlite3 is synchronous
    const result = db.insert(accounts).values(account).onConflictDoNothing().run?.();
    console.log(`[seedAccountsData] Insert result for ${account.id}:`, result);
  }
  
  console.log("[seedAccountsData] Account seeding completed");
}

// Optional: allow running this file directly in dev
if (process.argv[1]?.includes("seed-accounts")) {
  seedAccountsData()
    .then(() => {
      console.log("\nAccounts seeding completed successfully!");
    })
    .catch((error) => {
      console.error("\nAccounts seeding failed:", error);
      process.exitCode = 1;
    });
}
