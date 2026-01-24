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
      // how to locate the binary / environment
      binary: "copilot", // or absolute path if needed
      // workspace execution defaults
      timeoutMs: 300000,
      // optional: any SDK/CLI server settings you expose
      server: {
        // port: 0, // let it pick
        // transport: "stdio" | "tcp" (depending on SDK)
      },
      // policy defaults (can be overridden per-run in runs.toolPolicySnapshot)
      toolPolicy: {
        // conservative default: require explicit allow-list
        mode: "allow_list",
        allow: ["shell", "read_file", "write_file", "git"],
        deny: ["rm", "sudo"],
      },
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
    isEnabled: false, // enable when integration lands
    defaultModel: "claude-3-5-sonnet", // placeholder
    config: {
      binary: "claude", // or whatever you use
      timeoutMs: 300000,
      toolPolicy: {
        mode: "allow_list",
        allow: ["shell", "read_file", "write_file", "git"],
      },
    },
    capabilities: {
      mode: ["run"],
      tools: true,
      streaming: true,
      workspaceAware: true,
      artifacts: ["patch", "file", "log", "command_result"],
      notes: "Reserved for Claude Code adapter (same run model as Copilot)",
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
