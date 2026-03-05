import crypto from "crypto";
import { eq } from "drizzle-orm";
import { connections, connectionSyncState } from "../schema";
import { getDb } from "../client";


function createId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(12).toString("base64url");
  return `c${timestamp}${randomStr}`.slice(0, 24);
}

async function ensureConnectionExists(
  db: ReturnType<typeof getDb>,
  provider: string,
  displayName: string,
  type: string,
  defaultStatus: "active" | "revoked" | "error" | "disabled",
  metadata: unknown
) {
  const existing = await db.query.connections.findFirst({
    where: eq(connections.provider, provider),
  });

  if (existing) {
    return existing.id;
  }

  // Create new connection
  const connectionId = createId();

  await db.insert(connections).values({
    id: connectionId,
    provider,
    type,
    displayName,
    status: defaultStatus,
    scopes: JSON.stringify([]),
    metadata: JSON.stringify(metadata),
  });

  // Initialize sync state
  await db.insert(connectionSyncState).values({
    connectionId,
    cursor: null,
    lastSyncAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    backoffUntil: null,
    etag: null,
  });

  return connectionId;
}


export async function seedConnections(): Promise<void> {
  console.log("🌱 Seeding connections...");

  const db = getDb();

  try {
    // GitHub Connection
    const githubConnectionId = await ensureConnectionExists(
      db,
      "github",
      "GitHub",
      "api_key",
      "revoked",
      null
    );

    // Linear Connection
    const linearConnectionId = await ensureConnectionExists(
      db,
      "linear",
      "Linear",
      "api_key",
      "revoked",
      null
    );

    // GitLab Connection
    const gitlabConnectionId = await ensureConnectionExists(
      db,
      "gitlab",
      "GitLab",
      "api_key",
      "revoked",
      null
    );

    // Jira Connection
    const jiraConnectionId = await ensureConnectionExists(
      db,
      "jira",
      "Jira",
      "api_key",
      "revoked",
      null
    );

    // Asana Connection
    const asanaConnectionId = await ensureConnectionExists(
      db,
      "asana",
      "Asana",
      "api_key",
      "revoked",
      null
    );

    // Summary
    console.log("\n✨ Successfully seeded connections!");
    console.log("\n📊 Summary:");
    console.log(`   GitHub: ${githubConnectionId}`);
    console.log(`   GitLab: ${gitlabConnectionId}`);
    console.log(`   Linear: ${linearConnectionId}`);
    console.log(`   Jira: ${jiraConnectionId}`);
    console.log(`   Asana: ${asanaConnectionId}`);
  } catch (error) {
    console.error("❌ Error seeding connections:", error);
    throw error;
  }
}

// Optional: allow running this file directly in dev
if (process.argv[1]?.includes("seed-connections")) {
  seedConnections()
    .then(() => {
      console.log("\n✅ Seeding completed successfully!");
    })
    .catch((error) => {
      console.error("\n❌ Seeding failed:", error);
      process.exitCode = 1;
    });
}
