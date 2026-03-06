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
  const noBg = canonName === "Edit" || canonName === "Write" || toolName === "[permission:write]";
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
    try {
      const parsed = JSON.parse(input.args);
      if (typeof parsed === "object" && parsed !== null) return { ...input, ...parsed };
    } catch { /* ignore */ }
  }
  return input;
}

function filePath(input: Record<string, unknown>): string {
  return str(input.fileName ?? input.filePath ?? input.file_path ?? input.path ?? input.file ?? "");
}

function str(val: unknown, maxLen = 300): string {
  const s = typeof val === "string" ? val : String(val ?? "");
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-primary-300 dark:text-primary-400 break-all">
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-primary-400 dark:text-primary-500 text-xxs capitalize tracking-wide">
      {children}
    </span>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="text-primary-300 dark:text-primary-400 whitespace-pre-wrap break-all px-3 py-2 mt-1">
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
    <div className="text-xs leading-relaxed font-mono px-3 py-2 max-h-40 overflow-y-auto noscrollbar">
      {lines.map((l, lineNum) => (
        <div
          key={`${lineNum}:${l.type}`}
          className={
            l.type === "add"
              ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
              : l.type === "remove"
                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                : "text-primary-600 dark:text-primary-400"
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
      {input.description && (
        <div className="text-primary-400 dark:text-primary-500 italic">
          {str(input.description)}
        </div>
      )}
      <CodeBlock>{str(input.command, 1200)}</CodeBlock>
      {input.timeout && (
        <div className="text-primary-500 text-xxs">
          timeout: {String(input.timeout)}ms
        </div>
      )}
    </>
  ),

  Read: (input) => (
    <>
      <div>
        <Label>file</Label> <Mono>{str(input.file_path)}</Mono>
      </div>
      {(input.offset || input.limit) && (
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
        <Label>file</Label> <Mono>{str(input.file_path)}</Mono>
      </div>
      {input.content && (
        <div className="bg-primary-50 dark:bg-primary/5 rounded-lg">
          <DiffView newStr={str(input.content, 600)} />
        </div>
      )}
    </>
  ),

  Edit: (input) => (
    <>
      <div className="px-1 pb-1">
        <Label>file</Label> <Mono>{str(input.file_path ?? input.path)}</Mono>
      </div>
      <div className="bg-primary-50 dark:bg-primary/5 rounded-lg">
        <DiffView
          oldStr={input.old_string ? str(input.old_string, 600) : input.old_str ? str(input.old_str, 600) : undefined}
          newStr={input.new_string ? str(input.new_string, 600) : input.new_str ? str(input.new_str, 600) : undefined}
        />
      </div>
    </>
  ),

  Grep: (input) => (
    <>
      <div>
        <Label>pattern</Label>{" "}
        <Mono>{str(input.pattern)}</Mono>
      </div>
      {input.path && (
        <div>
          <Label>path</Label> <Mono>{str(input.path)}</Mono>
        </div>
      )}
      {input.glob && (
        <div>
          <Label>glob</Label> <Mono>{str(input.glob)}</Mono>
        </div>
      )}
    </>
  ),

  Glob: (input) => (
    <>
      <div>
        <Label>pattern</Label>{" "}
        <Mono>{str(input.pattern)}</Mono>
      </div>
      {input.path && (
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
      {input.prompt && (
        <div className="text-primary-400 dark:text-primary-500 italic mt-1">
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
      {input.subagent_type && (
        <div>
          <Label>agent</Label>{" "}
          <span className="text-primary-300 dark:text-primary-400">
            {str(input.subagent_type)}
          </span>
        </div>
      )}
      {input.description && (
        <div className="text-primary-400 dark:text-primary-500 italic">
          {str(input.description)}
        </div>
      )}
    </>
  ),

  AskUser: (input) => (
    <div className="px-3 py-2 text-primary-300 dark:text-primary-400">
      {str(input.question, 500)}
    </div>
  ),

  Ask_user: (input) => (
    <div className="px-3 py-2 text-primary-300 dark:text-primary-400">
      {str(input.question, 500)}
    </div>
  ),

  NotebookEdit: (input) => (
    <>
      <div>
        <Label>notebook</Label> <Mono>{str(input.notebook_path)}</Mono>
      </div>
      {input.edit_mode && (
        <div>
          <Label>mode</Label>{" "}
          <span className="text-primary-300 dark:text-primary-400">
            {str(input.edit_mode)}
          </span>
        </div>
      )}
      {input.new_source && (
        <CodeBlock>{str(input.new_source, 400)}</CodeBlock>
      )}
    </>
  ),

  "[permission:write]": (input) => (
    <>

      <div className="px-1 pb-1">
        <Label>file</Label> <Mono>{filePath(input)}</Mono>
      </div>
      {input.diff && (
        <div className="bg-primary-50 dark:bg-primary/5 rounded-lg">
          <DiffView diff={String(input.diff)} />
        </div>
      )}
    </>
  ),

  "[permission:shell]": (input) => (
    <>
      {input.cwd && (
        <div className="px-3 pt-2">
          <Label>cwd</Label> <Mono>{str(input.cwd)}</Mono>
        </div>
      )}
      <CodeBlock>{str(input.command, 1200)}</CodeBlock>
    </>
  ),

  "[permission:read]": (input) => (
    <div className="px-3 py-2">
      <Label>file</Label> <Mono>{filePath(input)}</Mono>
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
      <pre className="text-primary-400 dark:text-primary-500 whitespace-pre-wrap break-all">
        {s.length > 500 ? s.slice(0, 500) + "\n…" : s}
      </pre>
    );
  } catch {
    return null;
  }
}
