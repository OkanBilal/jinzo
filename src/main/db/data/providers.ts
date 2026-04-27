import type { CreateProviderPayload } from "../../modules/providers/providers.dto";

export const seedProviders: CreateProviderPayload[] = [

  {
    id: "copilot_cli",
    kind: "agent_runtime",
    displayName: "GitHub Copilot (CLI/SDK)",
    isEnabled: true,
    defaultModel: "claude-opus-4-6",
    config: {
      transport: "stdio" as const,
      timeout: 600000,
      logLevel: "info" as const,
      autoRestart: false,
    },
    capabilities: {
      mode: ["run"],
      streaming: true,
      workspaceAware: true,
      artifacts: ["patch", "file", "log", "command_result"],
      notes: "Code-writing runs via Copilot SDK + Copilot CLI server mode",
    },
  },

  {
    id: "claude_code",
    kind: "agent_runtime",
    displayName: "Claude Code (Local Agent)",
    isEnabled: true,
    defaultModel: "claude-opus-4-6",
    config: {
      timeout: 600000,
      apiKey: process.env.ANTHROPIC_API_KEY,
      permissionMode: "default",
    },
    capabilities: {
      mode: ["run"],
      tools: true,
      streaming: true,
      workspaceAware: true,
      artifacts: ["patch", "file", "log", "command_result"],
      notes: "Claude Code adapter using Anthropic SDK",
    },
  },

  {
    id: "codex",
    kind: "agent_runtime",
    displayName: "OpenAI Codex (CLI/SDK)",
    isEnabled: true,
    defaultModel: "gpt-5.4",
    config: {
      timeout: 600000,
      approvalMode: "on-failure",
      sandboxMode: "workspace-write",
      permissionMode: "default",
      networkAccessEnabled: true,
      webSearchMode: "live",
      personality: "none",
    },
    capabilities: {
      mode: ["run"],
      tools: true,
      streaming: true,
      workspaceAware: true,
      artifacts: ["patch", "file", "log", "command_result"],
      notes: "OpenAI Codex adapter using @openai/codex-sdk",
    },
  },

  {
    id: "cursor",
    kind: "agent_runtime",
    displayName: "Cursor (ACP/CLI)",
    isEnabled: true,
    defaultModel: "composer-2",
    config: {
      timeout: 600000,
      mode: "agent",
    },
    capabilities: {
      mode: ["run"],
      tools: true,
      streaming: true,
      workspaceAware: true,
      artifacts: ["patch", "file", "log", "command_result"],
      notes: "Cursor adapter using ACP (Agent Client Protocol) over JSON-RPC",
    },
  },
];
