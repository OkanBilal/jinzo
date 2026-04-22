// ─────────────────────────────────────────────────────────────
// Shared utilities for work run adapters (Claude & Copilot)
// Pure functions with no SDK-specific dependencies.
// ─────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  WorkRunEvent,
  WorkRunEventHandler,
  WorkRunContextItem,
  FileAttachment,
} from "./adapter.types";

// ─────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────

export interface AdapterLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(prefix: string): AdapterLogger {
  return {
    info: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

// ─────────────────────────────────────────────────────────────
// Pre-approved tools (auto-allow without user dialog)
// ─────────────────────────────────────────────────────────────

export const DEFAULT_ALLOWED_TOOLS = [
  "Bash",
  "Read",
  "Glob",
  "Grep",
  "LSP",
  "Task",
  "TaskCreate",
  "TaskList",
  "TaskGet",
  "TaskUpdate",
  "TodoWrite",
  "ExitPlanMode",
  "EnterPlanMode",
  "ListMcpResources",
  "ReadMcpResource",
  "WebFetch",
  "WebSearch",
  "ToolSearch",
  "NotebookEdit",
  "Skill",
  "Agent",
  "mcp__jinzo__GetWorkspaceDiff",
  "mcp__jinzo__SaveReview",
  "mcp__jinzo__SaveFinding",
  "mcp__jinzo__SaveFindings",
  "mcp__jinzo__CommitChanges",
  "mcp__jinzo__CreatePR",
  "mcp__jinzo__CheckPackage",
];

export const ALLOWED_TOOLS_SET = new Set(DEFAULT_ALLOWED_TOOLS);

// ─────────────────────────────────────────────────────────────
// JSON helper
// ─────────────────────────────────────────────────────────────

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ─────────────────────────────────────────────────────────────
// File attachments
// ─────────────────────────────────────────────────────────────

export function saveAttachments(
  attachments: FileAttachment[],
  runId: string,
): { savedPaths: string[]; inlineTexts: string[] } {
  const uploadDir = path.join(os.tmpdir(), "jinzo-uploads", runId);
  fs.mkdirSync(uploadDir, { recursive: true });

  const savedPaths: string[] = [];
  const inlineTexts: string[] = [];

  for (const attachment of attachments) {
    const filePath = path.join(uploadDir, attachment.name);
    const ext = path.extname(attachment.name).toLowerCase();
    const hasSource = typeof attachment.sourcePath === "string" && attachment.sourcePath.length > 0;

    // Inline text documents are read into the prompt regardless of source.
    if (attachment.type !== "image" && ext === ".txt") {
      let text = "";
      if (hasSource) {
        try {
          text = fs.readFileSync(attachment.sourcePath!, "utf-8");
        } catch {
          text = "";
        }
      } else if (attachment.data) {
        text = Buffer.from(attachment.data, "base64").toString("utf-8");
      }
      inlineTexts.push(`[Attached document: ${attachment.name}]\n${text}`);
      continue;
    }

    if (hasSource) {
      // Copy from disk directly — avoids holding base64 in memory.
      try {
        fs.copyFileSync(attachment.sourcePath!, filePath);
        savedPaths.push(filePath);
      } catch (err) {
        console.warn("[adapter.shared] failed to copy attachment from sourcePath:", err);
      }
    } else if (attachment.data) {
      fs.writeFileSync(filePath, Buffer.from(attachment.data, "base64"));
      savedPaths.push(filePath);
    }
  }

  return { savedPaths, inlineTexts };
}

function buildAttachmentPrompt(
  attachments: FileAttachment[],
  runId: string,
): string {
  if (!attachments || attachments.length === 0) return "";

  const { savedPaths, inlineTexts } = saveAttachments(attachments, runId);
  const parts: string[] = [];

  for (const filePath of savedPaths) {
    const ext = path.extname(filePath).toLowerCase();
    const isImage = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".bmp",
      ".svg",
    ].includes(ext);
    if (isImage) {
      parts.push(
        `I've attached an image: ${filePath}\nUse the Read tool to view it.`,
      );
    } else {
      parts.push(
        `I've attached a file: ${filePath}\nUse the Read tool to read its contents.`,
      );
    }
  }

  for (const text of inlineTexts) {
    parts.push(text);
  }

  return parts.join("\n\n");
}

// ─────────────────────────────────────────────────────────────
// Artifact extraction from tool output
// ─────────────────────────────────────────────────────────────

export function extractArtifactsFromToolOutput(
  toolName: string,
  output: unknown,
): WorkRunEvent[] {
  const artifacts: WorkRunEvent[] = [];

  if (
    toolName === "Write" ||
    toolName === "Edit" ||
    toolName === "write_file" ||
    toolName === "edit_file" ||
    toolName === "create_file" ||
    toolName === "str_replace_editor"
  ) {
    const out = output as Record<string, unknown> | undefined;
    if (out?.path && typeof out.path === "string") {
      artifacts.push({
        type: "artifact",
        kind: "file",
        path: out.path,
        content: typeof out.content === "string" ? out.content : undefined,
        metadata: { toolName },
      });
    } else if (out?.file_path && typeof out.file_path === "string") {
      artifacts.push({
        type: "artifact",
        kind: "file",
        path: out.file_path,
        content: typeof out.content === "string" ? out.content : undefined,
        metadata: { toolName },
      });
    }
  }

  if (
    toolName === "apply_patch" ||
    toolName === "apply_diff" ||
    toolName === "patch"
  ) {
    const out = output as Record<string, unknown> | undefined;
    const patch = (out as any)?.patch ?? (out as any)?.diff;
    if (patch) {
      artifacts.push({
        type: "artifact",
        kind: "patch",
        path:
          typeof (out as any)?.path === "string"
            ? String((out as any).path)
            : undefined,
        content: typeof patch === "string" ? patch : safeJson(patch),
        metadata: { toolName },
      });
    }
  }

  return artifacts;
}

// ─────────────────────────────────────────────────────────────
// Prompt building
// ─────────────────────────────────────────────────────────────

/**
 * Format context items into a section string.
 */
export function formatContextSection(
  context: WorkRunContextItem[],
): string {
  return context
    .map((ctx) => {
      const header = ctx.ref
        ? `[${ctx.kind}: ${ctx.ref}]`
        : `[${ctx.kind}]`;
      return `${header}\n${ctx.content || "(no content)"}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Format context issues into a section string.
 */
export function formatIssuesSection(
  issues: Array<{
    provider: string;
    number?: number | null;
    title: string;
    body?: string | null;
  }>,
  includeBody = true,
): string {
  return issues
    .map((i) => {
      const label = `[${i.provider.toUpperCase()}${i.number ? ` #${i.number}` : ""}] ${i.title}`;
      return includeBody && i.body ? `${label}\n${i.body}` : label;
    })
    .join("\n\n---\n\n");
}

/**
 * Format context signals into a section string.
 */
export function formatSignalsSection(
  signals: Array<{
    source: string;
    level: string;
    category: string;
    title: string;
    body?: string | null;
    stackTrace?: string | null;
    eventCount?: number;
  }>,
  includeBody = true,
): string {
  return signals
    .map((s) => {
      const label = `[${s.source.toUpperCase()} ${s.level.toUpperCase()}] ${s.title}${s.eventCount && s.eventCount > 1 ? ` (${s.eventCount}x)` : ""}`;
      const parts = [label];
      if (includeBody && s.body) parts.push(s.body);
      if (includeBody && s.stackTrace) parts.push(`Stack trace:\n${s.stackTrace}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * Format context files into a section string.
 */
export function formatFilesSection(
  files: Array<{ path: string }>,
): string {
  return files.map((f) => `- ${f.path}`).join("\n");
}

/**
 * Append optional sections (issues, files, attachments) to a base prompt.
 */
export function appendPromptSections(
  prompt: string,
  options: {
    contextIssues?: Array<{
      provider: string;
      number?: number | null;
      title: string;
      body?: string | null;
    }>;
    contextSignals?: Array<{
      source: string;
      level: string;
      category: string;
      title: string;
      body?: string | null;
      stackTrace?: string | null;
      eventCount?: number;
    }>;
    contextFiles?: Array<{ path: string }>;
    attachments?: FileAttachment[];
    runId?: string;
    includeIssueBody?: boolean;
  },
): string {
  let result = prompt;

  if (options.contextIssues && options.contextIssues.length > 0) {
    const issuesList = formatIssuesSection(
      options.contextIssues,
      options.includeIssueBody ?? true,
    );
    result = `${result}\n\n---\n\nContext issues:\n${issuesList}`;
  }

  if (options.contextSignals && options.contextSignals.length > 0) {
    const signalsList = formatSignalsSection(
      options.contextSignals,
      options.includeIssueBody ?? true,
    );
    result = `${result}\n\n---\n\nContext signals (error reports):\n${signalsList}`;
  }

  if (options.contextFiles && options.contextFiles.length > 0) {
    const filesList = formatFilesSection(options.contextFiles);
    result = `${result}\n\n---\n\nContext files (read these before starting):\n${filesList}`;
  }

  if (
    options.attachments &&
    options.attachments.length > 0 &&
    options.runId
  ) {
    const attachmentSection = buildAttachmentPrompt(
      options.attachments,
      options.runId,
    );
    if (attachmentSection) {
      result = `${result}\n\n---\n\nAttached files:\n${attachmentSection}`;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// User prompt artifact emission
// ─────────────────────────────────────────────────────────────

export async function emitUserPromptArtifact(
  onEvent: WorkRunEventHandler,
  content: string,
  options?: {
    attachments?: FileAttachment[];
    contextIssues?: Array<{
      provider: string;
      number?: number | null;
      title: string;
      body?: string | null;
    }>;
    contextSignals?: Array<{
      source: string;
      level: string;
      category: string;
      title: string;
      body?: string | null;
      stackTrace?: string | null;
      eventCount?: number;
    }>;
    contextFiles?: Array<{ path: string }>;
  },
): Promise<void> {
  await onEvent({
    type: "artifact",
    kind: "user-prompt",
    content,
    metadata: {
      source: "user",
      attachments: options?.attachments?.map((a) => {
        const captureName =
          a.sourcePath && a.sourcePath.replace(/\\/g, "/").includes("/browser-captures/")
            ? path.basename(a.sourcePath)
            : undefined;
        return {
          name: a.name,
          type: a.type,
          mimeType: a.mimeType,
          ...(a.type === "image" && a.data
            ? { dataUrl: `data:${a.mimeType};base64,${a.data}` }
            : {}),
          ...(a.sourcePath ? { sourcePath: a.sourcePath } : {}),
          ...(captureName ? { captureName } : {}),
        };
      }),
      issues: options?.contextIssues,
      signals: options?.contextSignals,
      files: options?.contextFiles,
    },
  });
}
