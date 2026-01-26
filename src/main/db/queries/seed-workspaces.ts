import { seedWorkspaces } from "../data/workspaces";
import { workspaces } from "../schema";
import { getDb } from "../client";

export async function seedWorkspacesData(): Promise<void> {
  console.log("[seedWorkspacesData] Starting workspace seeding...");
  console.log("[seedWorkspacesData] Number of workspaces to seed:", seedWorkspaces.length);
  
  const db = getDb();

  for (const workspace of seedWorkspaces) {
    console.log(`[seedWorkspacesData] Seeding workspace: ${workspace.id}`);
    
    const workspaceData = {
      id: workspace.id,
      accountId: workspace.accountId,
      name: workspace.name,
      rootPath: workspace.rootPath,
      repoUrl: workspace.repoUrl ?? null,
      defaultBranch: workspace.defaultBranch ?? null,
      metadata: workspace.metadata ? JSON.stringify(workspace.metadata) : null,
    };

    // drizzle-orm/better-sqlite3 is synchronous
    const result = db.insert(workspaces).values(workspaceData).onConflictDoNothing().run?.();
    console.log(`[seedWorkspacesData] Insert result for ${workspace.id}:`, result);
  }
  
  console.log("[seedWorkspacesData] Workspace seeding completed");
}

// Optional: allow running this file directly in dev
if (process.argv[1]?.includes("seed-workspaces")) {
  seedWorkspacesData()
    .then(() => {
      console.log("\nWorkspaces seeding completed successfully!");
    })
    .catch((error) => {
      console.error("\nWorkspaces seeding failed:", error);
      process.exitCode = 1;
    });
}
