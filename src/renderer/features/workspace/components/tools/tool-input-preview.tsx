import { coerceToolOutput } from "../../utils/parse-tool-content";

interface ToolInputPreviewProps {
  toolName: string;
  toolInput?: Record<string, unknown>;
}

export function ToolInputPreview({ toolName, toolInput }: ToolInputPreviewProps) {
  if (!toolInput || Object.keys(toolInput).length === 0) return null;

  // Normalize: if toolInput is { args: "<json>" }, parse it
  const input = normalizeInput(toolInput);

  // Case-insensitive lookup (Copilot sends "edit", Claude sends "Edit")
  const renderer = RENDERERS[toolName]
    ?? RENDERERS[toolName.charAt(0).toUpperCase() + toolName.slice(1)]
    ?? (toolName.startsWith("[permission:") ? renderPermissionFallback : renderFallback);
  const canonName = RENDERERS[toolName] ? toolName : toolName.charAt(0).toUpperCase() + toolName.slice(1);
  const noBg = canonName === "Edit" || canonName === "Write" || canonName === "Create" || canonName === "Apply_patch" || toolName === "[permission:write]";
  return (
    <div className={`text-xs rounded-lg overflow-x-auto max-h-48 space-y-2 ${noBg ? "" : "bg-primary-50 dark:bg-primary/5"}`}>
      {renderer(input)}
    </div>
  );
}

// --- helpers ---

/** If input is { args: "<json string>" }, parse args and merge into top level */
function normalizeInput(input: Record<string, unknown>): Record<string, unknown> {
  if (typeof input.args === "string") {
    const parsed = coerceToolOutput(input.args);
    if (typeof parsed === "object" && parsed !== null) return { ...input, ...parsed };
  }
  return input;
}

function filePath(input: Record<string, unknown>): string {
  return str(input.fileName ?? input.filePath ?? input.file_path ?? input.path ?? input.file ?? "");
}

/**
 * Copilot's apply_patch passes the whole `*** Begin Patch …` envelope as a
 * string (usually under `args`). Pull the target file out of the
 * `*** Update File:` header and reduce the envelope to a +/-/context diff body
 * that DiffView understands (drop the `*** …` markers and `@@` hunk lines).
 */
function parseApplyPatchEnvelope(input: Record<string, unknown>): {
  file: string;
  body: string;
} {
  const isEnv = (v: unknown): v is string =>
    typeof v === "string" && v.includes("*** Begin Patch");
  const patch =
    [input.args, input.patch, input.input, input.content].find(isEnv) ??
    Object.values(input).find(isEnv) ??
    "";
  if (!patch) return { file: "", body: "" };
  const fileMatch = patch.match(/\*\*\* (?:Update|Add|Delete|Move to) File: (.+)/);
  const body = patch
    .split("\n")
    .filter((l) => !l.startsWith("*** ") && !l.startsWith("@@"))
    .join("\n");
  return { file: fileMatch ? fileMatch[1].trim() : "", body };
}

/** Approval / tool preview: show only the filename, not the full absolute path */
function basenameDisplay(p: string): string {
  if (!p) return "";
  const normalized = p.replace(/\\/g, "/").trim();
  const withoutQuery = normalized.split("?")[0] ?? normalized;
  const parts = withoutQuery.split("/").filter((s) => s.length > 0);
  return parts.length > 0 ? parts[parts.length - 1]! : p;
}

function str(val: unknown, maxLen = 300): string {
  const s = typeof val === "string" ? val : String(val ?? "");
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-primary-700 dark:text-primary-300 break-all">
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-primary-600 dark:text-primary-400 text-xs capitalize tracking-wide">
      {children}
    </span>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="text-primary-700 dark:text-primary-300 whitespace-pre-wrap break-all px-3 py-2 mt-1">
      {children}
    </pre>
  );
}

function DiffView({ diff, oldStr, newStr }: { diff?: string; oldStr?: string; newStr?: string }) {
  let lines: { prefix: string; text: string; type: "add" | "remove" | "context" }[] = [];

  if (diff) {
    lines = diff
      .split("\n")
      .filter((l) => !l.startsWith("diff ") && !l.startsWith("index ") && !l.startsWith("--- ") && !l.startsWith("+++ ") && !l.startsWith("@@") && l !== "")
      .map((l) => {
        if (l.startsWith("+")) return { prefix: "+", text: l.slice(1), type: "add" as const };
        if (l.startsWith("-")) return { prefix: "-", text: l.slice(1), type: "remove" as const };
        return { prefix: " ", text: l.startsWith(" ") ? l.slice(1) : l, type: "context" as const };
      });
  } else if (oldStr || newStr) {
    if (oldStr) for (const l of oldStr.split("\n")) lines.push({ prefix: "-", text: l, type: "remove" });
    if (newStr) for (const l of newStr.split("\n")) lines.push({ prefix: "+", text: l, type: "add" });
  }

  if (lines.length === 0) return null;

  return (
    <div className="text-xs leading-relaxed font-mono   max-h-40 overflow-y-auto noscrollbar">
      {lines.map((l, lineNum) => (
        <div
          key={`${lineNum}:${l.type}`}
          className={
            l.type === "add"
              ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2"
              : l.type === "remove"
                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2"
                : "text-primary-600 dark:text-primary-400 px-2"
          }
        >
          {l.prefix}{l.text}
        </div>
      ))}
    </div>
  );
}

// --- per-tool renderers ---

type Renderer = (input: Record<string, unknown>) => React.ReactNode;

const RENDERERS: Record<string, Renderer> = {
  Bash: (input) => (
    <>
      {!!input.description && (
        <div className="px-3 pt-2 text-primary-600 dark:text-primary-400 leading-relaxed whitespace-pre-wrap wrap-break-word">
          {str(input.description, 500)}
        </div>
      )}
      <CodeBlock>{str(input.command, 1200)}</CodeBlock>
      {!!input.timeout && (
        <div className="px-3 pb-2 text-primary-500 text-xxs">
          timeout: {String(input.timeout)}ms
        </div>
      )}
    </>
  ),

  Read: (input) => (
    <>
      <div>
        <Label>file</Label>{" "}
        <Mono>{basenameDisplay(str(input.file_path))}</Mono>
      </div>
      {!!(input.offset || input.limit) && (
        <div className="text-primary-500 text-xxs">
          {input.offset ? `from line ${input.offset}` : ""}
          {input.offset && input.limit ? ", " : ""}
          {input.limit ? `${input.limit} lines` : ""}
        </div>
      )}
    </>
  ),

  Write: (input) => (
    <>
      <div className="px-1 pb-1">
        <Label>file</Label>{" "}
        <Mono>{basenameDisplay(str(input.file_path))}</Mono>
      </div>
      {!!input.content && (
        <div className="bg-primary-50 dark:bg-primary/5 rounded-lg">
          <DiffView newStr={str(input.content, 600)} />
        </div>
      )}
    </>
  ),

  // Copilot CLI file-creation tool: input is { file_text, path }. Show the
  // filename + the new content as an all-added diff (mirrors Write) instead of
  // dumping the entire file_text as a raw param value.
  Create: (input) => {
    const content = input.file_text ?? input.content;
    return (
      <>
        <div className="px-1 pb-1">
          <Label>file</Label>{" "}
          <Mono>{basenameDisplay(filePath(input))}</Mono>
        </div>
        {!!content && (
          <div className="bg-primary-50 dark:bg-primary/5 rounded-lg">
            <DiffView newStr={str(content, 600)} />
          </div>
        )}
      </>
    );
  },

  Edit: (input) => (
    <>
      <div className="px-1 pb-1">
        <Label>file</Label>{" "}
        <Mono>
          {basenameDisplay(str(input.file_path ?? input.path))}
        </Mono>
      </div>
      <div className="bg-primary-50 dark:bg-primary/5 rounded-lg">
        <DiffView
          oldStr={input.old_string ? str(input.old_string, 600) : input.old_str ? str(input.old_str, 600) : undefined}
          newStr={input.new_string ? str(input.new_string, 600) : input.new_str ? str(input.new_str, 600) : undefined}
        />
      </div>
    </>
  ),

  Apply_patch: (input) => {
    const { file, body } = parseApplyPatchEnvelope(input);
    return (
      <>
        <div className="px-1 pb-1">
          <Label>file</Label>{" "}
          <Mono>{basenameDisplay(file)}</Mono>
        </div>
        {!!body && (
          <div className="bg-primary-50 dark:bg-primary/5 rounded-lg">
            <DiffView diff={body} />
          </div>
        )}
      </>
    );
  },

  // Copilot CLI's sql tool: { description, query } (session-state todo DB).
  Sql: (input) => (
    <>
      {!!input.description && (
        <div className="px-3 pt-2 text-primary-600 dark:text-primary-400 leading-relaxed whitespace-pre-wrap wrap-break-word">
          {str(input.description, 300)}
        </div>
      )}
      <CodeBlock>{str(input.query, 1200)}</CodeBlock>
    </>
  ),

  Grep: (input) => (
    <>
      <div>
        <Label>pattern</Label>{" "}
        <Mono>{str(input.pattern)}</Mono>
      </div>
      {!!input.path && (
        <div>
          <Label>path</Label> <Mono>{str(input.path)}</Mono>
        </div>
      )}
      {!!input.glob && (
        <div>
          <Label>glob</Label> <Mono>{str(input.glob)}</Mono>
        </div>
      )}
    </>
  ),

  // Copilot CLI's ripgrep tool: { pattern, paths, output_mode } where `paths`
  // is usually a single path string (sometimes an array).
  Rg: (input) => {
    const paths = Array.isArray(input.paths)
      ? input.paths.map((p) => String(p))
      : typeof input.paths === "string" && input.paths
        ? [input.paths]
        : input.path
          ? [String(input.path)]
          : [];
    return (
      <>
        <div>
          <Label>pattern</Label>{" "}
          <Mono>{str(input.pattern ?? input.query ?? input.regex ?? "")}</Mono>
        </div>
        {paths.length > 0 && (
          <div>
            <Label>path</Label>{" "}
            <Mono>{paths.map(basenameDisplay).join(", ")}</Mono>
          </div>
        )}
        {!!input.glob && (
          <div>
            <Label>glob</Label> <Mono>{str(input.glob)}</Mono>
          </div>
        )}
        {!!input.output_mode && (
          <div className="text-primary-500 text-xxs">
            {str(input.output_mode)}
          </div>
        )}
      </>
    );
  },

  Glob: (input) => (
    <>
      <div>
        <Label>pattern</Label>{" "}
        <Mono>{str(input.pattern)}</Mono>
      </div>
      {!!input.path && (
        <div>
          <Label>path</Label> <Mono>{str(input.path)}</Mono>
        </div>
      )}
    </>
  ),

  WebFetch: (input) => (
    <>
      <div>
        <Label>url</Label> <Mono>{str(input.url)}</Mono>
      </div>
      {!!input.prompt && (
        <div className="text-primary-600 dark:text-primary-400 mt-1">
          {str(input.prompt)}
        </div>
      )}
    </>
  ),

  WebSearch: (input) => (
    <div>
      <Label>query</Label>{" "}
      <Mono>{str(input.query)}</Mono>
    </div>
  ),

  Task: (input) => (
    <>
      {!!input.subagent_type && (
        <div>
          <Label>agent</Label>{" "}
          <span className="text-primary-700 dark:text-primary-300">
            {str(input.subagent_type)}
          </span>
        </div>
      )}
      {!!input.description && (
        <div className="text-primary-600 dark:text-primary-400">
          {str(input.description)}
        </div>
      )}
    </>
  ),

   Plan: (input) => (
    <div className="px-3 py-2 space-y-1">
      {!!input.name && (
        <div className="text-primary-800 dark:text-primary-200 font-medium text-sm">
          {str(input.name)}
        </div>
      )}
      {!!input.overview && (
        <div className="text-primary-600 dark:text-primary-400">
          {str(input.overview, 500)}
        </div>
      )}
      {!!input.plan && (
        <pre className="text-primary-700 dark:text-primary-300 whitespace-pre-wrap wrap-break-word leading-relaxed mt-1">
          {str(input.plan, 2000)}
        </pre>
      )}
    </div>
  ),

  AskUser: (input) => (
    <div className="px-3 py-2 text-primary-700 dark:text-primary-300">
      {str(input.question, 500)}
    </div>
  ),

  Ask_user: (input) => (
    <div className="px-3 py-2 text-primary-700 dark:text-primary-300">
      {str(input.question, 500)}
    </div>
  ),

  NotebookEdit: (input) => (
    <>
      <div>
        <Label>notebook</Label>{" "}
        <Mono>{basenameDisplay(str(input.notebook_path))}</Mono>
      </div>
      {!!input.edit_mode && (
        <div>
          <Label>mode</Label>{" "}
          <span className="text-primary-700 dark:text-primary-300">
            {str(input.edit_mode)}
          </span>
        </div>
      )}
      {!!input.new_source && (
        <CodeBlock>{str(input.new_source, 400)}</CodeBlock>
      )}
    </>
  ),

  "[permission:write]": (input) => (
    <>

      <div className="px-1 pb-1">
        <Label>file</Label> <Mono>{basenameDisplay(filePath(input))}</Mono>
      </div>
      {!!input.diff && (
        <div className="bg-primary-50 dark:bg-primary/5 rounded-lg">
          <DiffView diff={String(input.diff)} />
        </div>
      )}
    </>
  ),

  "[permission:shell]": (input) => (
    <>
      {!!input.cwd && (
        <div className="px-3 pt-2">
          <Label>cwd</Label> <Mono>{str(input.cwd)}</Mono>
        </div>
      )}
      <CodeBlock>{str(input.command, 1200)}</CodeBlock>
    </>
  ),

  "[permission:read]": (input) => (
    <div className="px-3 py-2">
      <Label>file</Label> <Mono>{basenameDisplay(filePath(input))}</Mono>
    </div>
  ),
};

function renderPermissionFallback(input: Record<string, unknown>): React.ReactNode {
  const { kind: _, toolCallId: __, ...rest } = input;
  return renderFallback(rest);
}

function renderFallback(input: Record<string, unknown>): React.ReactNode {
  try {
    const s = JSON.stringify(input, null, 2);
    return (
      <pre className="text-primary-600 dark:text-primary-400 whitespace-pre-wrap break-all">
        {s.length > 500 ? s.slice(0, 500) + "\n…" : s}
      </pre>
    );
  } catch {
    return null;
  }
}
