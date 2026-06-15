import type { CreateProviderPayload } from "../../modules/providers/providers.dto";
import { PROVIDER_IDS } from "../../../shared/provider-ids";

export const seedProviders: CreateProviderPayload[] = [

  {
    id: PROVIDER_IDS.copilot,
    kind: "agent_runtime",
    displayName: "GitHub Copilot (CLI/SDK)",
    isEnabled: true,
    defaultModel: "claude-sonnet-4-6",
    config: {
      transport: "stdio" as const,
      timeout: 3_600_000,
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
    id: PROVIDER_IDS.claude,
    kind: "agent_runtime",
    displayName: "Claude Code (Local Agent)",
    isEnabled: true,
    defaultModel: "claude-opus-4-8",
    config: {
      timeout: 3_600_000,
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
    id: PROVIDER_IDS.codex,
    kind: "agent_runtime",
    displayName: "OpenAI Codex (CLI/SDK)",
    isEnabled: true,
    defaultModel: "gpt-5.4",
    config: {
      timeout: 3_600_000,
      approvalMode: "on-request",
      sandboxMode: "workspace-write",
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
    id: PROVIDER_IDS.cursor,
    kind: "agent_runtime",
    displayName: "Cursor (ACP/CLI)",
    isEnabled: true,
    defaultModel: "composer-2.5[fast=true]",
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
