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
    defaultModel: "gpt-4o-mini", // placeholder; SDK may pick its own default
    config: {
      // CopilotAdapterConfig interface fields
      binary: "copilot", // Path to copilot CLI binary
      transport: "stdio" as const, // Transport mode: "stdio" or "tcp"
      timeout: 300000, // Timeout in milliseconds
      logLevel: "info" as const, // Log level for the SDK
      autoRestart: true, // Auto-restart on crash
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
    defaultModel: "claude-3-5-sonnet-20241022", // Updated model name
    config: {
      // ClaudeCodeAdapterConfig interface fields
      binary: "claude", // Path to claude CLI binary (if using CLI)
      timeout: 300000, // Timeout in milliseconds
      apiKey: process.env.ANTHROPIC_API_KEY, // API key from environment
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

  // ─────────────────────────────────────────────
  // LLM Runtime: OpenAI (future / remote)
  // ─────────────────────────────────────────────
  {
    id: "openai",
    kind: "llm_runtime",
    displayName: "OpenAI",
    isEnabled: false,
    defaultModel: "gpt-4o-mini",
    config: {
      apiKeyRef: "OPENAI_API_KEY", // store key elsewhere; keep config clean
      baseUrl: "https://api.openai.com/v1",
    },
    capabilities: {
      mode: ["chat"],
      streaming: true,
      vision: true,
      tools: true,
      notes: "Remote LLM provider (optional)",
    },
  },
];
