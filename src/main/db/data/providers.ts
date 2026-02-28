import type { CreateProviderPayload } from "../../modules/providers/providers.dto";

export const seedProviders: CreateProviderPayload[] = [
  // {
  //   id: "ollama",
  //   kind: "llm_runtime",
  //   displayName: "Ollama (Local)",
  //   isEnabled: true,
  //   defaultModel: "llama3.1",
  //   config: {
  //     baseUrl: "http://localhost:11434",
  //     // optional: a per-provider default options bag you can pass to /api/chat
  //     options: {
  //       // temperature: 0.7,
  //       // num_ctx: 8192,
  //     },
  //   },
  //   capabilities: {
  //     mode: ["chat"], // only chat right now
  //     streaming: false,
  //     vision: false,
  //     tools: false,
  //     maxContextTokens: 8192,
  //     notes: "Local LLM via Ollama HTTP API",
  //   },
  // },

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
];
