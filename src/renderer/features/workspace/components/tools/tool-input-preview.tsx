interface ToolInputPreviewProps {
  toolName: string;
  toolInput?: Record<string, unknown>;
}

export function ToolInputPreview({ toolName, toolInput }: ToolInputPreviewProps) {
  if (!toolInput || Object.keys(toolInput).length === 0) return null;

  const renderer = RENDERERS[toolName] ?? renderFallback;
  return (
    <div className="text-xs bg-primary-100/30 dark:bg-primary/5 rounded-lg  overflow-x-auto max-h-48 space-y-2">
      {renderer(toolInput)}
    </div>
  );
}

// --- helpers ---

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
    <span className="text-primary-400 dark:text-primary-500 text-xxs uppercase tracking-wide">
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
      <div className="bg-primary/5 px-3 py-2">
        <Label>file</Label> <Mono>{str(input.file_path)}</Mono>
      </div>
      {input.content && (
        <CodeBlock>{str(input.content, 400)}</CodeBlock>
      )}
    </>
  ),

  Edit: (input) => (
    <>
      <div>
        <Label>file</Label> <Mono>{str(input.file_path)}</Mono>
      </div>
      {input.old_string && (
        <pre className="text-red-400/80 bg-red-500/5 rounded px-2 py-1.5 mt-1 whitespace-pre-wrap break-all line-through decoration-red-400/30">
          {str(input.old_string, 300)}
        </pre>
      )}
      {input.new_string && (
        <pre className="text-green-400/80 bg-green-500/5 rounded px-2 py-1.5 mt-0.5 whitespace-pre-wrap break-all">
          {str(input.new_string, 300)}
        </pre>
      )}
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
};

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
