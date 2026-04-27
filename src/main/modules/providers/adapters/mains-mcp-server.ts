// ─────────────────────────────────────────────────────────────
// Mains MCP Stdio Server + IPC Bridge
//
// Exposes Mains tools (CommitChanges, CreatePR, etc.) as a
// stdio-based MCP server that Cursor can discover and spawn.
//
// Architecture:
//   Cursor ACP  ──spawns──▶  temp MCP script (stdin/stdout)
//                                 │ Unix socket IPC
//                                 ▼
//                         Bridge (main Electron process)
//                                 │
//                                 ▼
//                         mains-tools.core.ts handlers
//
// The server writes a `.cursor/mcp.json` config in the workspace
// directory so Cursor discovers the tools automatically. It also
// returns a config for session/new as a fallback.
// ─────────────────────────────────────────────────────────────

import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import type { MainsToolContext } from "./mains-tools.core";
import type { WorkRunEventHandler } from "./adapter.types";
import {
  TOOL_DESCRIPTIONS,
  handleGetWorkspaceDiff,
  handleSaveReview,
  handleSaveFinding,
  handleSaveFindings,
  handleCommitChanges,
  handleCreatePR,
  handleCheckPackage,
} from "./mains-tools.core";

// ─────────────────────────────────────────────────────────────
// Tool definitions (JSON Schema format for the MCP script)
// ─────────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: "GetWorkspaceDiff",
    description: TOOL_DESCRIPTIONS.GetWorkspaceDiff,
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID to get diff for a specific run" },
      },
    },
  },
  {
    name: "SaveReview",
    description: TOOL_DESCRIPTIONS.SaveReview,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Review title" },
        summary: { type: "string", description: "Review summary" },
        status: { type: "string", enum: ["open", "in_review", "approved", "rejected"], description: "Review status" },
        metadata: { type: "object", description: "Additional metadata as JSON" },
      },
      required: ["title"],
    },
  },
  {
    name: "SaveFinding",
    description: TOOL_DESCRIPTIONS.SaveFinding,
    inputSchema: {
      type: "object",
      properties: {
        reviewId: { type: "string", description: "ID of the parent review" },
        severity: { type: "string", enum: ["critical", "warning", "info"], description: "Finding severity level" },
        file: { type: "string", description: "File path where the finding was detected" },
        lineStart: { type: "number", description: "Start line number" },
        lineEnd: { type: "number", description: "End line number" },
        message: { type: "string", description: "Description of the finding" },
        reason: { type: "string", description: "Why this was flagged" },
        suggestion: { type: "string", description: "Suggested fix" },
        metadata: { type: "object", description: "Additional metadata as JSON" },
      },
      required: ["reviewId", "severity", "file", "message", "reason"],
    },
  },
  {
    name: "SaveFindings",
    description: TOOL_DESCRIPTIONS.SaveFindings,
    inputSchema: {
      type: "object",
      properties: {
        reviewId: { type: "string", description: "ID of the parent review" },
        findings: {
          type: "array",
          description: "Array of findings to save",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["critical", "warning", "info"] },
              file: { type: "string" },
              lineStart: { type: "number" },
              lineEnd: { type: "number" },
              message: { type: "string" },
              reason: { type: "string" },
              suggestion: { type: "string" },
              metadata: { type: "object" },
            },
            required: ["severity", "file", "message", "reason"],
          },
        },
      },
      required: ["reviewId", "findings"],
    },
  },
  {
    name: "CommitChanges",
    description: TOOL_DESCRIPTIONS.CommitChanges,
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The commit message. Omit on first call to retrieve commitInstructions if configured." },
        files: { type: "array", items: { type: "string" }, description: "Specific files to stage. If omitted, stages all changes (git add -A)" },
      },
    },
  },
  {
    name: "CreatePR",
    description: TOOL_DESCRIPTIONS.CreatePR,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The pull request title" },
        body: { type: "string", description: "The pull request body/description" },
        base: { type: "string", description: "The base branch to merge into (defaults to the repo default branch)" },
        draft: { type: "boolean", description: "Create as a draft pull request" },
        labels: { type: "array", items: { type: "string" }, description: "Labels to add to the pull request" },
      },
      required: ["title"],
    },
  },
  {
    name: "CheckPackage",
    description: TOOL_DESCRIPTIONS.CheckPackage,
    inputSchema: {
      type: "object",
      properties: {
        packages: {
          type: "array",
          description: "Packages to check",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Package name" },
              version: { type: "string", description: "Optional version" },
              ecosystem: { type: "string", enum: ["npm", "pypi", "cargo", "go", "maven", "rubygems"], description: "Package ecosystem (defaults to npm)" },
            },
            required: ["name"],
          },
        },
      },
      required: ["packages"],
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Standalone MCP stdio script (written to a temp file at runtime)
// ─────────────────────────────────────────────────────────────

function buildMcpScript(toolDefs: typeof TOOL_DEFINITIONS): string {
  return `"use strict";
const net = require("net");
const SOCKET_PATH = process.env.MAINS_IPC_SOCKET;
const TOOLS = ${JSON.stringify(toolDefs, null, 2)};

// ── Stdio JSON-RPC transport ──
let stdinBuf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdinBuf += chunk;
  let nl;
  while ((nl = stdinBuf.indexOf("\\n")) !== -1) {
    const line = stdinBuf.slice(0, nl).trim();
    stdinBuf = stdinBuf.slice(nl + 1);
    if (line) handleMessage(line);
  }
});
process.stdin.on("end", () => process.exit(0));

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(msg + "\\n");
}
function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
  process.stdout.write(msg + "\\n");
}

// ── Socket IPC for tool dispatch ──
function callBridge(toolName, args) {
  return new Promise((resolve, reject) => {
    const reqId = Math.random().toString(36).slice(2);
    const client = net.createConnection(SOCKET_PATH, () => {
      client.write(JSON.stringify({ id: reqId, tool: toolName, args }) + "\\n");
    });
    let buf = "";
    client.on("data", (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf("\\n");
      if (nl !== -1) {
        try { resolve(JSON.parse(buf.slice(0, nl))); }
        catch (e) { reject(new Error("Bad bridge response")); }
        client.end();
      }
    });
    client.on("error", (err) => reject(err));
    client.on("close", () => {
      if (!buf.trim()) reject(new Error("Bridge closed without response"));
    });
    setTimeout(() => { client.destroy(); reject(new Error("Bridge timeout")); }, 60000);
  });
}

// ── MCP message handler ──
async function handleMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  const { id, method, params } = msg;

  // Notifications (no id) — just acknowledge
  if (id === undefined || id === null) return;

  switch (method) {
    case "initialize":
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mains", version: "1.0.0" },
      });
      break;

    case "tools/list":
      sendResponse(id, { tools: TOOLS });
      break;

    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const result = await callBridge(toolName, toolArgs);
        if (result.isError) {
          sendResponse(id, { content: result.content, isError: true });
        } else {
          sendResponse(id, { content: result.content });
        }
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: "Error: " + (err.message || String(err)) }],
          isError: true,
        });
      }
      break;
    }

    default:
      sendError(id, -32601, "Method not found: " + method);
      break;
  }
}

process.stderr.write("[mains-mcp] Server started, socket: " + SOCKET_PATH + "\\n");
`;
}

// ─────────────────────────────────────────────────────────────
// Dispatch tool calls to mains-tools.core handlers
// ─────────────────────────────────────────────────────────────

async function dispatchTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: MainsToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  switch (toolName) {
    case "GetWorkspaceDiff":
      return handleGetWorkspaceDiff(args as any, ctx);
    case "SaveReview":
      return handleSaveReview(args as any, ctx);
    case "SaveFinding":
      return handleSaveFinding(args as any, ctx);
    case "SaveFindings":
      return handleSaveFindings(args as any, ctx);
    case "CommitChanges":
      return handleCommitChanges(args as any, ctx);
    case "CreatePR":
      return handleCreatePR(args as any, ctx);
    case "CheckPackage":
      return handleCheckPackage(args as any, ctx);
    default:
      return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
  }
}

// ─────────────────────────────────────────────────────────────
// Find Node.js binary
//
// In packaged Electron apps, `node` may not be on PATH.
// Use ELECTRON_RUN_AS_NODE=1 with the Electron binary itself
// as the primary strategy — it makes Electron act as plain Node.js.
// ─────────────────────────────────────────────────────────────

interface NodeBinaryInfo {
  command: string;
  extraEnv: Record<string, string>;
}

function findNodeBinary(): NodeBinaryInfo {
  const homedir = os.homedir();

  // 1. Direct `which node` (works in dev mode / terminal-launched apps)
  try {
    const result = execSync("which node", { encoding: "utf-8", timeout: 3000 }).trim();
    if (result && fs.existsSync(result)) {
      return { command: result, extraEnv: {} };
    }
  } catch { /* not found */ }

  // 2. Common absolute paths (brew Intel/ARM)
  const staticCandidates = [
    "/usr/local/bin/node",
    "/opt/homebrew/bin/node",
    "/usr/bin/node",
  ];
  for (const c of staticCandidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return { command: c, extraEnv: {} };
    } catch { /* not here */ }
  }

  // 3. nvm — scan ~/.nvm/versions/node/*/bin/node, pick latest
  try {
    const nvmDir = path.join(homedir, ".nvm", "versions", "node");
    if (fs.existsSync(nvmDir)) {
      const versions = fs.readdirSync(nvmDir)
        .filter((d) => d.startsWith("v"))
        .sort()
        .reverse();
      for (const v of versions) {
        const nodePath = path.join(nvmDir, v, "bin", "node");
        try {
          fs.accessSync(nodePath, fs.constants.X_OK);
          return { command: nodePath, extraEnv: {} };
        } catch { /* not this version */ }
      }
    }
  } catch { /* nvm not installed */ }

  // 4. volta — ~/.volta/bin/node
  try {
    const voltaNode = path.join(homedir, ".volta", "bin", "node");
    fs.accessSync(voltaNode, fs.constants.X_OK);
    return { command: voltaNode, extraEnv: {} };
  } catch { /* not found */ }

  // 5. fnm — ~/.local/share/fnm/node-versions/*/installation/bin/node
  try {
    const fnmDir = path.join(homedir, ".local", "share", "fnm", "node-versions");
    if (fs.existsSync(fnmDir)) {
      const versions = fs.readdirSync(fnmDir).sort().reverse();
      for (const v of versions) {
        const nodePath = path.join(fnmDir, v, "installation", "bin", "node");
        try {
          fs.accessSync(nodePath, fs.constants.X_OK);
          return { command: nodePath, extraEnv: {} };
        } catch { /* not this version */ }
      }
    }
  } catch { /* fnm not installed */ }

  // 6. Fallback: Electron binary with ELECTRON_RUN_AS_NODE=1
  return {
    command: process.execPath,
    extraEnv: { ELECTRON_RUN_AS_NODE: "1" },
  };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export class MainsMcpStdioServer {
  private socketServer: net.Server | null = null;
  private socketPath: string;
  private scriptPath: string;
  private nodeInfo: NodeBinaryInfo;
  private workspacePath: string | null;
  private onEvent: WorkRunEventHandler | null = null;
  /** Tracks original content for each .cursor/mcp.json we modified */
  private mcpJsonBackups = new Map<string, string | null>();

  constructor(private ctx: MainsToolContext) {
    const id = crypto.randomUUID().slice(0, 8);
    const tmpDir = os.tmpdir();
    this.socketPath = path.join(tmpDir, `mains-mcp-${id}.sock`);
    this.scriptPath = path.join(tmpDir, `mains-mcp-${id}.cjs`);
    this.nodeInfo = findNodeBinary();
    this.workspacePath = ctx.rootPath;
  }

  async start(): Promise<void> {
    // 1. Write the MCP script to a temp file
    const script = buildMcpScript(TOOL_DEFINITIONS);
    fs.writeFileSync(this.scriptPath, script, "utf8");

    // 2. Start the Unix socket bridge
    const ctx = this.ctx;
    this.socketServer = net.createServer((conn) => {
      let buf = "";
      conn.on("data", (chunk) => {
        buf += chunk.toString();
        const nl = buf.indexOf("\n");
        if (nl === -1) return;

        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);

        let req: { id: string; tool: string; args: Record<string, unknown> };
        try {
          req = JSON.parse(line);
        } catch {
          conn.end(JSON.stringify({ id: null, content: [{ type: "text", text: "Parse error" }], isError: true }) + "\n");
          return;
        }

        const startedAt = Date.now();
        // Emit tool_call start event
        this.onEvent?.({
          type: "tool_call",
          toolName: req.tool,
          input: req.args,
          startedAt,
          metadata: { phase: "start", source: "mains-mcp" },
        });

        dispatchTool(req.tool, req.args, ctx)
          .then((result) => {
            const outputText = result.content.map((c) => c.text).join("\n");
            // Emit tool_call complete event
            this.onEvent?.({
              type: "tool_call",
              toolName: req.tool,
              input: req.args,
              output: outputText,
              error: result.isError ? outputText : undefined,
              startedAt,
              endedAt: Date.now(),
              metadata: { phase: "complete", source: "mains-mcp" },
            });
            conn.end(JSON.stringify({ id: req.id, content: result.content, isError: result.isError }) + "\n");
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.onEvent?.({
              type: "tool_call",
              toolName: req.tool,
              input: req.args,
              error: msg,
              startedAt,
              endedAt: Date.now(),
              metadata: { phase: "complete", source: "mains-mcp" },
            });
            conn.end(JSON.stringify({ id: req.id, content: [{ type: "text", text: `Error: ${msg}` }], isError: true }) + "\n");
          });
      });
    });

    // Clean up stale socket file if exists
    try { fs.unlinkSync(this.socketPath); } catch { /* doesn't exist */ }

    await new Promise<void>((resolve, reject) => {
      this.socketServer!.listen(this.socketPath, () => resolve());
      this.socketServer!.on("error", reject);
    });

    // 3. Write .cursor/mcp.json so Cursor discovers the tools
    //    Write to BOTH workspace-level and user-level configs
    if (this.workspacePath) {
      this.writeCursorMcpConfig(path.join(this.workspacePath, ".cursor"));
    }
    this.writeCursorMcpConfig(path.join(os.homedir(), ".cursor"));
  }

  async stop(): Promise<void> {
    // Restore original .cursor/mcp.json files
    this.restoreCursorMcpConfig();

    if (this.socketServer) {
      await new Promise<void>((resolve) => {
        this.socketServer!.close(() => resolve());
      });
      this.socketServer = null;
    }

    // Clean up temp files
    try { fs.unlinkSync(this.socketPath); } catch { /* ok */ }
    try { fs.unlinkSync(this.scriptPath); } catch { /* ok */ }
  }

  get isRunning(): boolean {
    return this.socketServer !== null && this.socketServer.listening;
  }

  setEventHandler(handler: WorkRunEventHandler): void {
    this.onEvent = handler;
  }

  /**
   * Returns the mcpServers config entry for Cursor ACP's session/new.
   */
  get mcpConfig(): {
    name: string;
    command: string;
    args: string[];
    env: Array<{ name: string; value: string }>;
  } {
    const envEntries: Array<{ name: string; value: string }> = [
      { name: "MAINS_IPC_SOCKET", value: this.socketPath },
    ];
    for (const [k, v] of Object.entries(this.nodeInfo.extraEnv)) {
      envEntries.push({ name: k, value: v });
    }
    return {
      name: "mains",
      command: this.nodeInfo.command,
      args: [this.scriptPath],
      env: envEntries,
    };
  }

  /**
   * Write mcp.json in the given .cursor directory.
   * Preserves existing entries and backs up for restore on stop.
   */
  private writeCursorMcpConfig(cursorDir: string): void {
    const mcpJsonPath = path.join(cursorDir, "mcp.json");

    // Back up original content (only once per path)
    if (!this.mcpJsonBackups.has(mcpJsonPath)) {
      try {
        this.mcpJsonBackups.set(mcpJsonPath, fs.readFileSync(mcpJsonPath, "utf8"));
      } catch {
        this.mcpJsonBackups.set(mcpJsonPath, null);
      }
    }

    // Parse existing or start fresh
    let config: Record<string, any> = {};
    const original = this.mcpJsonBackups.get(mcpJsonPath);
    if (original) {
      try { config = JSON.parse(original); } catch { config = {}; }
    }

    // Add mains MCP server entry
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers["mains"] = {
      command: this.nodeInfo.command,
      args: [this.scriptPath],
      env: {
        MAINS_IPC_SOCKET: this.socketPath,
        ...this.nodeInfo.extraEnv,
      },
    };

    try {
      fs.mkdirSync(cursorDir, { recursive: true });
      fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2), "utf8");
    } catch (err) {
      console.error(`[MainsMcpServer] Failed to write ${mcpJsonPath}:`, err);
    }
  }

  /**
   * Restore all modified .cursor/mcp.json files on shutdown.
   */
  private restoreCursorMcpConfig(): void {
    for (const [mcpJsonPath, original] of this.mcpJsonBackups) {
      try {
        if (original !== null) {
          fs.writeFileSync(mcpJsonPath, original, "utf8");
        } else {
          // We created this file — remove our entry
          try {
            const current = JSON.parse(fs.readFileSync(mcpJsonPath, "utf8"));
            if (current.mcpServers) {
              delete current.mcpServers["mains"];
              if (Object.keys(current.mcpServers).length === 0 && Object.keys(current).length === 1) {
                fs.unlinkSync(mcpJsonPath);
              } else {
                fs.writeFileSync(mcpJsonPath, JSON.stringify(current, null, 2), "utf8");
              }
            }
          } catch {
            try { fs.unlinkSync(mcpJsonPath); } catch { /* ok */ }
          }
        }
      } catch { /* restoration failed, not critical */ }
    }
    this.mcpJsonBackups.clear();
  }
}
