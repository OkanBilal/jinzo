// ─────────────────────────────────────────────────────────────
// Seed v2 — Add Codex provider and space
// ─────────────────────────────────────────────────────────────

import { providers, spaces } from "../schema";
import type { DatabaseInstance } from "../types";

const ACCOUNT_ID = "default";

export async function run(db: DatabaseInstance): Promise<void> {
  // 1. Codex provider
  db.insert(providers)
    .values({
      id: "codex",
      kind: "agent_runtime",
      displayName: "OpenAI Codex (CLI/SDK)",
      isEnabled: true,
      config: JSON.stringify({
        timeout: 600000,
        approvalMode: "on-failure",
        sandboxMode: "workspace-write",
        permissionMode: "default",
        networkAccessEnabled: true,
        webSearchMode: "live",
      }),
      capabilities: JSON.stringify({
        mode: ["run"],
        tools: true,
        streaming: true,
        workspaceAware: true,
        artifacts: ["patch", "file", "log", "command_result"],
        notes: "OpenAI Codex adapter using @openai/codex-sdk",
      }),
      defaultModel: "gpt-5.4",
    })
    .onConflictDoNothing()
    .run?.();

  // 2. Codex space
  db.insert(spaces)
    .values({
      id: "codex",
      accountId: ACCOUNT_ID,
      name: "Codex",
      slug: "codex",
      description: null,
      systemPrompt: null,
      model: null,
      icon: "icon:code",
      themeConfig: JSON.stringify({
        lightBackground: "#c8e6c9",
        darkBackground: "#0d1117bf",
      }),
      uiConfig: JSON.stringify({
        sidebar: {
          width: "19rem",
          title: "Repository",
          itemType: "workspace",
          defaultRoute: "/codex",
        },
        main: { margin: "19rem" },
        rightPanel: { width: "22rem", component: "workspace" },
      }),
      sortOrder: 2,
    })
    .onConflictDoNothing()
    .run?.();
}
