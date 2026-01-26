import type { RunEvent } from "../types";

// Tool name display mapping
const TOOL_DISPLAY_NAMES: Record<string, { name: string; icon: string }> = {
  // File operations
  view: { name: "View File", icon: "👁" },
  read_file: { name: "Read File", icon: "📖" },
  write_file: { name: "Write File", icon: "✏️" },
  edit_file: { name: "Edit File", icon: "📝" },
  create_file: { name: "Create File", icon: "📄" },
  delete_file: { name: "Delete File", icon: "🗑️" },
  list_files: { name: "List Files", icon: "📁" },
  
  // Search & navigation
  search: { name: "Search", icon: "🔍" },
  grep: { name: "Grep Search", icon: "🔎" },
  find_files: { name: "Find Files", icon: "📂" },
  
  // Terminal & shell
  shell: { name: "Run Shell", icon: "💻" },
  terminal: { name: "Terminal", icon: "⌨️" },
  run_command: { name: "Run Command", icon: "▶️" },
  execute_shell: { name: "Execute Shell", icon: "🖥️" },
  bash: { name: "Bash", icon: "🐚" },
  
  // Git operations
  git_status: { name: "Git Status", icon: "📊" },
  git_diff: { name: "Git Diff", icon: "±" },
  git_commit: { name: "Git Commit", icon: "📦" },
  git_push: { name: "Git Push", icon: "⬆️" },
  git_pull: { name: "Git Pull", icon: "⬇️" },
  
  // Copilot specific
  report_intent: { name: "Report Intent", icon: "🎯" },
  fetch_copilot_cli_documentation: { name: "Fetch CLI Docs", icon: "📚" },
  
  // Patches & diffs
  apply_patch: { name: "Apply Patch", icon: "🩹" },
  apply_diff: { name: "Apply Diff", icon: "📋" },
  patch: { name: "Patch", icon: "🔧" },
  
  // Misc
  think: { name: "Thinking", icon: "🤔" },
  plan: { name: "Planning", icon: "📋" },
  summarize: { name: "Summarize", icon: "📝" },
};

// Log type display mapping
const LOG_TYPE_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  reasoning: { name: "Reasoning", icon: "💭", color: "text-amber-400 bg-amber-500/10" },
  event: { name: "Event", icon: "📡", color: "text-cyan-400 bg-cyan-500/10" },
  usage: { name: "Usage", icon: "📊", color: "text-slate-400 bg-slate-500/10" },
  info: { name: "Info", icon: "ℹ️", color: "text-blue-400 bg-blue-500/10" },
  warn: { name: "Warning", icon: "⚠️", color: "text-yellow-400 bg-yellow-500/10" },
  error: { name: "Error", icon: "❌", color: "text-red-400 bg-red-500/10" },
  debug: { name: "Debug", icon: "🔧", color: "text-gray-400 bg-gray-500/10" },
};

// Artifact type display mapping  
const ARTIFACT_TYPE_DISPLAY: Record<string, { name: string; icon: string }> = {
  file: { name: "File", icon: "📄" },
  patch: { name: "Patch", icon: "🩹" },
  report: { name: "Response", icon: "💬" },
  code: { name: "Code", icon: "💻" },
  log: { name: "Log", icon: "📋" },
};

function getToolDisplayName(toolName: string): { name: string; icon: string } {
  if (TOOL_DISPLAY_NAMES[toolName]) {
    return TOOL_DISPLAY_NAMES[toolName];
  }
  
  const lowerName = toolName.toLowerCase();
  if (TOOL_DISPLAY_NAMES[lowerName]) {
    return TOOL_DISPLAY_NAMES[lowerName];
  }
  
  const formatted = toolName
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  
  return { name: formatted, icon: "⚙️" };
}

// Parse log content to extract type prefix like [reasoning], [event], etc.
function parseLogContent(content: string): { type: string | null; message: string } {
  const match = content.match(/^\[(\w+)\]\s*/);
  if (match) {
    return { type: match[1].toLowerCase(), message: content.substring(match[0].length) };
  }
  return { type: null, message: content };
}

// Get artifact kind from metadata or content
function getArtifactKind(event: RunEvent): string {
  if (event.metadata?.kind && typeof event.metadata.kind === "string") {
    return event.metadata.kind;
  }
  // Try to detect from content
  if (event.content.startsWith("diff ") || event.content.includes("@@")) {
    return "patch";
  }
  if (event.content.includes("```")) {
    return "code";
  }
  return "report";
}

interface TerminalEventLineProps {
  event: RunEvent;
  isLast: boolean;
}

export function TerminalEventLine({ event, isLast }: TerminalEventLineProps) {
  const time = event.timestamp.toLocaleTimeString("en-US", { hour12: true });

  // Extract tool name from content for tool_call events
  const getToolInfo = () => {
    if (event.type !== "tool_call") return null;
    
    const colonIdx = event.content.indexOf(":");
    if (colonIdx === -1) return null;
    
    const rawToolName = event.content.substring(0, colonIdx).trim();
    const restContent = event.content.substring(colonIdx + 1).trim();
    
    return {
      ...getToolDisplayName(rawToolName),
      rawName: rawToolName,
      content: restContent,
    };
  };

  const toolInfo = getToolInfo();
  const parsedLog = event.type === "log" ? parseLogContent(event.content) : null;
  const artifactKind = event.type === "artifact" ? getArtifactKind(event) : null;

  const renderContent = () => {
    // Tool call rendering
    if (event.type === "tool_call" && toolInfo) {
      const lines = toolInfo.content.split("\n");
      return (
        <div className="space-y-1">
          {lines.map((line, i) => {
            if (i === 0 && line.trim()) {
              return (
                <div key={i} className="text-primary-300 text-[13px] font-mono">
                  {line}
                </div>
              );
            }
            if (line.startsWith("→")) {
              return (
                <div key={i} className="flex items-start gap-2 pl-2 border-l-2 border-green-500/30">
                  <span className="text-green-300 text-[13px] font-mono">{line.substring(1).trim()}</span>
                </div>
              );
            }
            if (line.trim()) {
              return (
                <div key={i} className="text-primary-400 text-[13px] font-mono pl-2">
                  {line}
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }

    // Log rendering with parsed type
    if (event.type === "log" && parsedLog) {
      const message = parsedLog.message;
      
      // Check if it's JSON-like content
      if (message.startsWith("{") || message.startsWith("[")) {
        try {
          const parsed = JSON.parse(message);
          const preview = JSON.stringify(parsed).substring(0, 150);
          return (
            <div className="text-primary-400 text-[13px] font-mono">
              {preview}{preview.length >= 150 ? "..." : ""}
            </div>
          );
        } catch {
          // Not valid JSON, continue
        }
      }
      
      // For long messages, truncate
      const maxLen = 300;
      const displayMsg = message.length > maxLen 
        ? message.substring(0, maxLen) + "..." 
        : message;
      
      return (
        <div className={`text-[13px] ${
          parsedLog.type === "error" || event.metadata?.level === "error" 
            ? "text-red-300" 
            : parsedLog.type === "warn" || event.metadata?.level === "warn"
              ? "text-yellow-300"
              : parsedLog.type === "reasoning"
                ? "text-amber-200/80 italic"
                : "text-primary-400"
        }`}>
          {displayMsg}
        </div>
      );
    }

    // Artifact rendering
    if (event.type === "artifact") {
      const content = event.content;
      const lines = content.split("\n");
      const lineCount = lines.length;
      
      // For short content, show inline
      if (lineCount <= 5 && content.length < 300) {
        return (
          <div className="text-green-300/90 text-[13px]">
            {content}
          </div>
        );
      }
      
      // For longer content, show preview
      const preview = lines.slice(0, 3).join("\n");
      return (
        <div className="space-y-1">
          <div className="text-green-300/90 text-[13px] whitespace-pre-wrap">
            {preview}
          </div>
          {lineCount > 3 && (
            <div className="text-primary-500 text-[13px]">
              ... +{lineCount - 3} more lines
            </div>
          )}
        </div>
      );
    }

    // Status rendering
    if (event.type === "status") {
      return (
        <div className="text-blue-300 text-[13px] font-medium">
          {event.content}
        </div>
      );
    }

    // Default
    return (
      <div className="text-primary-300 text-[13px]">
        {event.content}
      </div>
    );
  };

  // Get display label for event type
  const getEventLabel = (): { label: React.ReactNode; colorClass: string } => {
    if (event.type === "tool_call" && toolInfo) {
      return {
        label: (
          <span className="flex items-center gap-1.5">
            <span>{toolInfo.icon}</span>
            <span>{toolInfo.name}</span>
          </span>
        ),
        colorClass: "text-purple-400 bg-purple-500/10",
      };
    }
    
    if (event.type === "log" && parsedLog?.type) {
      const logType = LOG_TYPE_DISPLAY[parsedLog.type] || LOG_TYPE_DISPLAY.info;
      return {
        label: (
          <span className="flex items-center gap-1.5">
            <span>{logType.icon}</span>
            <span>{logType.name}</span>
          </span>
        ),
        colorClass: logType.color,
      };
    }
    
    if (event.type === "log") {
      const level = event.metadata?.level as string | undefined;
      if (level && LOG_TYPE_DISPLAY[level]) {
        const logType = LOG_TYPE_DISPLAY[level];
        return {
          label: (
            <span className="flex items-center gap-1.5">
              <span>{logType.icon}</span>
              <span>{logType.name}</span>
            </span>
          ),
          colorClass: logType.color,
        };
      }
      return {
        label: (
          <span className="flex items-center gap-1.5">
            <span>📋</span>
            <span>Log</span>
          </span>
        ),
        colorClass: "text-primary-400 bg-primary-500/10",
      };
    }
    
    if (event.type === "artifact" && artifactKind) {
      const artType = ARTIFACT_TYPE_DISPLAY[artifactKind] || ARTIFACT_TYPE_DISPLAY.report;
      return {
        label: (
          <span className="flex items-center gap-1.5">
            <span>{artType.icon}</span>
            <span>{artType.name}</span>
          </span>
        ),
        colorClass: "text-green-400 bg-green-500/10",
      };
    }
    
    if (event.type === "status") {
      return {
        label: (
          <span className="flex items-center gap-1.5">
            <span>◆</span>
            <span>Status</span>
          </span>
        ),
        colorClass: "text-blue-400 bg-blue-500/10",
      };
    }
    
    return {
      label: event.type,
      colorClass: "text-primary-500 bg-primary-500/10",
    };
  };

  const { label, colorClass } = getEventLabel();

  return (
    <div className="group hover:bg-[#161b22] px-4 py-1.5 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-primary-600 text-[13px] tabular-nums">{time}</span>
        </div>

        <span className={`text-[13px] px-2 py-1 rounded-lg shrink-0 min-w-24 ${colorClass}`}>
          {label}
        </span>

        <div className="flex-1 overflow-x-auto">{renderContent()}</div>
      </div>


    </div>
  );
}
