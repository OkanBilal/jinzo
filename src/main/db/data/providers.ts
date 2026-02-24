import type { CreateProviderPayload } from "../../modules/providers/providers.dto";

// ─────────────────────────────────────────────────────────────
// Default Providers Seed Data
// ─────────────────────────────────────────────────────────────

export const seedProviders: CreateProviderPayload[] = [
  // ─────────────────────────────────────────────
  // LLM Runtime: Ollama (Chat)
  // ─────────────────────────────────────────────
  {
    id: "ollama",
    kind: "llm_runtime",
    displayName: "Ollama (Local)",
    isEnabled: true,
    defaultModel: "llama3.1",
    config: {
      baseUrl: "http://localhost:11434",
      // optional: a per-provider default options bag you can pass to /api/chat
      options: {
        // temperature: 0.7,
        // num_ctx: 8192,
      },
    },
    capabilities: {
      mode: ["chat"], // only chat right now
      streaming: false,
      vision: false,
      tools: false,
      maxContextTokens: 8192,
      notes: "Local LLM via Ollama HTTP API",
    },
  },

  // ─────────────────────────────────────────────
  // Agent Runtime: GitHub Copilot (CLI/SDK)
  // ─────────────────────────────────────────────
  {
    id: "copilot_cli",
    kind: "agent_runtime",
    displayName: "GitHub Copilot (CLI/SDK)",
    isEnabled: true,
    defaultModel: "claude-opus-4-5-20251101",
    config: {
      // CopilotAdapterConfig interface fields
      // binary is auto-resolved from @github/copilot package; only set for custom paths
      transport: "stdio" as const, // Transport mode: "stdio" or "tcp"
      timeout: 600000, // Timeout in milliseconds
      logLevel: "info" as const, // Log level for the SDK
      autoRestart: false, // Auto-restart on crash
    },
    capabilities: {
      mode: ["run"], // work runs
      tools: true,
      streaming: true,
      workspaceAware: true,
      artifacts: ["patch", "file", "log", "command_result"],
      notes: "Code-writing runs via Copilot SDK + Copilot CLI server mode",
    },
  },

  // ─────────────────────────────────────────────
  // Agent Runtime: Claude Code (future)
  // ─────────────────────────────────────────────
  {
    id: "claude_code",
    kind: "agent_runtime",
    displayName: "Claude Code (Local Agent)",
    isEnabled: true, // Enable Claude provider
    defaultModel: "claude-opus-4-5-20251101", // Updated model name
    config: {
      // ClaudeCodeAdapterConfig interface fields
      timeout: 600000, // Timeout in milliseconds (10 minutes)
      apiKey: process.env.ANTHROPIC_API_KEY, // API key from environment
      permissionMode: "default", // Permission mode for tool use
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

];
