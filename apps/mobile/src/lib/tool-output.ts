/**
 * Reading a tool call's input and output on the phone.
 *
 * The desktop's per-tool displays each carry their own parser for the shape
 * their provider emits (`structuredPatch` from Claude, `detailedContent` from
 * Copilot, a bare stdout string from a shell, …). Those parsers are the part
 * worth porting verbatim — the shapes are the wire, not the UI — so they live
 * here, decoupled from the components that render them.
 *
 * Everything is defensive: a payload we don't recognize degrades to pretty
 * JSON rather than an empty row.
 */

/** `tool_calls.input_json` → params object, or `{}`. */
export function parseToolInput(inputJson: string | null): Record<string, unknown> {
  if (!inputJson) return {};
  try {
    const parsed: unknown = JSON.parse(inputJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    // Copilot's apply_patch sends a bare `*** Begin Patch …` string.
    if (typeof parsed === "string") return { _raw: parsed };
  } catch {
    /* fall through */
  }
  return {};
}

/**
 * `tool_calls.output_json` → the value the Mac recorded. The column is a
 * `JSON.stringify` of whatever the driver captured, and drivers often capture
 * a *string* that is itself JSON — so unwrap twice.
 */
export function coerceToolOutput(outputJson: string | null): unknown {
  if (!outputJson) return null;
  let value: unknown;
  try {
    value = JSON.parse(outputJson);
  } catch {
    return outputJson;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Flatten any tool result to renderable text: a bare string, an Anthropic
 * content-block array, an MCP `{ content: [...] }` envelope, else pretty JSON.
 */
export function toolOutputText(output: unknown): string {
  if (output === null || output === undefined) return "";
  if (typeof output === "string") return output.trim();

  const collected = collectText(output).join("\n").trim();
  if (collected) return collected;

  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return "";
  }
}

function collectText(value: unknown): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.content !== undefined) return collectText(obj.content);
    if (typeof obj.text === "string") return [obj.text];
  }
  return [];
}

/** CSI escape sequences, so a colored shell log reads as plain text. */
const ANSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

/** Shell output, stripped of escape codes and collapsed blank runs. */
export function parseShellOutput(output: unknown): string | null {
  if (typeof output === "string") return stripAnsi(output);
  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    const body = str(obj.stdout) ?? str(obj.content) ?? str(obj.output);
    if (body) return stripAnsi(body);
  }
  const text = toolOutputText(output);
  return text ? stripAnsi(text) : null;
}

function stripAnsi(input: string): string {
  return input
    .replace(ANSI_REGEX, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Read's file body plus its line count — `{ file: { content } }` or flat. */
export function parseReadOutput(output: unknown): { content: string | null; numLines: number } {
  if (typeof output === "string") {
    return { content: output, numLines: output.split("\n").length };
  }
  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (obj.file && typeof obj.file === "object") {
      const file = obj.file as Record<string, unknown>;
      const content = str(file.content);
      return { content, numLines: num(file.numLines) || (content ? content.split("\n").length : 0) };
    }
    const content = str(obj.content);
    if (content) {
      return { content, numLines: num(obj.numLines) || content.split("\n").length };
    }
  }
  const text = toolOutputText(output);
  return text ? { content: text, numLines: text.split("\n").length } : { content: null, numLines: 0 };
}

export interface GrepSummary {
  content: string | null;
  numFiles: number;
  numLines: number;
  totalMatches: number;
  truncated: boolean;
}

/** Grep / ripgrep results plus the counts the header shows in parentheses. */
export function parseGrepOutput(output: unknown): GrepSummary {
  const empty: GrepSummary = {
    content: null,
    numFiles: 0,
    numLines: 0,
    totalMatches: 0,
    truncated: false,
  };
  if (typeof output === "string") {
    return { ...empty, content: output, numLines: output.split("\n").length };
  }
  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    const filenames = Array.isArray(obj.filenames) ? (obj.filenames as string[]) : [];
    const content = str(obj.content) ?? (filenames.length > 0 ? filenames.join("\n") : null);
    return {
      content,
      numFiles: num(obj.numFiles) || num(obj.totalFiles) || filenames.length,
      numLines: num(obj.numLines),
      totalMatches: num(obj.totalMatches),
      truncated: obj.truncated === true,
    };
  }
  const text = toolOutputText(output);
  return text ? { ...empty, content: text, numLines: text.split("\n").length } : empty;
}

/** Glob results: the matched paths and how many there were. */
export function parseGlobOutput(output: unknown): { files: string[]; truncated: boolean } {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const obj = output as Record<string, unknown>;
    const list = Array.isArray(obj.filenames)
      ? obj.filenames
      : Array.isArray(obj.files)
        ? obj.files
        : null;
    if (list) {
      return {
        files: list.filter((f): f is string => typeof f === "string"),
        truncated: obj.truncated === true,
      };
    }
  }
  if (Array.isArray(output)) {
    return { files: output.filter((f): f is string => typeof f === "string"), truncated: false };
  }
  const text = toolOutputText(output);
  return {
    files: text ? text.split("\n").filter(Boolean) : [],
    truncated: false,
  };
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  text: string;
}

export interface Diff {
  lines: DiffLine[];
  added: number;
  removed: number;
}

const EMPTY_DIFF: Diff = { lines: [], added: 0, removed: 0 };

/**
 * The diff an Edit / Write / apply_patch produced. Four sources, in the order
 * the desktop trusts them: Claude's `structuredPatch`, Copilot's
 * `detailedContent` unified diff, a raw `*** Begin Patch` envelope on the
 * input, and finally the tool's own `old_string` / `new_string` params.
 */
export function parseDiff(output: unknown, params: Record<string, unknown>): Diff {
  const structured = extractStructuredPatch(output);
  if (structured.length > 0) return classify(structured);

  const unified = extractUnifiedDiff(output);
  if (unified.length > 0) return classify(unified);

  const envelope = str(params._raw) ?? str(params.patch) ?? str(params.input);
  if (envelope && envelope.includes("*** Begin Patch")) {
    return classify(patchEnvelopeLines(envelope));
  }

  const before = str(params.old_string) ?? str(params.old_str);
  const after = str(params.new_string) ?? str(params.new_str);
  if (before || after) {
    const lines: DiffLine[] = [
      ...(before ? before.split("\n").map((text) => ({ type: "remove" as const, text })) : []),
      ...(after ? after.split("\n").map((text) => ({ type: "add" as const, text })) : []),
    ];
    return {
      lines,
      added: after ? after.split("\n").length : 0,
      removed: before ? before.split("\n").length : 0,
    };
  }

  return EMPTY_DIFF;
}

function extractStructuredPatch(output: unknown): string[] {
  if (!output || typeof output !== "object") return [];
  const sp = (output as Record<string, unknown>).structuredPatch;
  if (!Array.isArray(sp)) return [];
  const lines: string[] = [];
  for (const hunk of sp) {
    if (hunk && typeof hunk === "object" && Array.isArray((hunk as Record<string, unknown>).lines)) {
      lines.push(...((hunk as Record<string, unknown>).lines as string[]));
    }
  }
  return lines;
}

function extractUnifiedDiff(output: unknown): string[] {
  if (!output || typeof output !== "object") return [];
  const content = str((output as Record<string, unknown>).detailedContent);
  if (!content) return [];

  const looksUnified =
    content.startsWith("--- ") || content.startsWith("diff ") || content.startsWith("@@");
  if (!looksUnified) {
    // A whole new file — every line is an addition.
    return content.split("\n").filter((l) => l !== "").map((l) => `+${l}`);
  }
  return content.split("\n").filter((l) => {
    if (l === "") return false;
    return !(
      l.startsWith("diff ") ||
      l.startsWith("index ") ||
      l.startsWith("--- ") ||
      l.startsWith("+++ ") ||
      l.startsWith("@@")
    );
  });
}

/** Keep only the body lines of a `*** Begin Patch … *** End Patch` envelope. */
function patchEnvelopeLines(envelope: string): string[] {
  return envelope
    .split("\n")
    .filter((l) => !l.startsWith("***") && !l.startsWith("@@") && l !== "");
}

function classify(raw: string[]): Diff {
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  for (const line of raw) {
    if (line.startsWith("+")) {
      lines.push({ type: "add", text: line.slice(1) });
      added++;
    } else if (line.startsWith("-")) {
      lines.push({ type: "remove", text: line.slice(1) });
      removed++;
    } else {
      lines.push({ type: "context", text: line.startsWith(" ") ? line.slice(1) : line });
    }
  }
  return { lines, added, removed };
}

/** The file a file-touching tool acted on, under any provider's param name. */
export function toolFilePath(params: Record<string, unknown>): string {
  return str(params.file_path) ?? str(params.path) ?? str(params.filePath) ?? "";
}

/** Collapse a deep path to its file name; shallow paths pass through whole. */
export function shortFileName(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? parts[parts.length - 1] : fullPath;
}

/** Abbreviate a deep path to its last three segments. */
export function shortPath(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? `.../${parts.slice(-3).join("/")}` : fullPath;
}

/**
 * The one line a tool row shows beside its verb — the param that carries the
 * gist, in the order the desktop's displays reach for it.
 */
const PREVIEW_KEYS = [
  "command",
  "description",
  "file_path",
  "path",
  "pattern",
  "query",
  "regex",
  "url",
  "skill",
  "prompt",
  "intent",
  "question",
  "name",
];

export function toolSummary(params: Record<string, unknown>, max = 120): string {
  for (const key of PREVIEW_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.length > 0) return truncate(value, max);
  }
  const first = Object.values(params).find((v) => typeof v === "string" && v.length > 0);
  return typeof first === "string" ? truncate(first, max) : "";
}

function truncate(value: string, max: number): string {
  const single = value.replace(/\s+/g, " ").trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}
