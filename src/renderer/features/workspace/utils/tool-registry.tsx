import {
  Bash,
  BrowserCursor,
  Check,
  Document,
  Edit,
  EnterPlan,
  ExitPlan,
  Figma,
  Github,
  Glob,
  Gmail,
  GoogleCalendar,
  Grep,
  Linear,
  Mains,
  Notion,
  Plus,
  Question,
  Read,
  Search,
  SendMessage,
  Slack,
  Sparkles,
  Task,
  Trash,
  Web,
} from "@/components/ui/icons";

export interface VerbInfo {
  /** Past-tense label used in display, e.g. "listed" → "Linear listed issues". */
  label: string;
  icon: React.ReactNode;
}

export interface VendorInfo {
  id: string;
  /** Human-readable vendor label, e.g. "Linear", "GitHub". */
  label: string;
  category: string;
  /** Tool name prefixes (with trailing separator) that identify this vendor. */
  prefixes: string[];
  icon: React.ReactNode;
  /**
   * Direct mapping from tool name (after prefix strip, lowercased) to a fixed
   * displayName. Used for tools that have specialized renderers in
   * `tool-call-item.tsx` (Mains: GetDiff, SaveReview, Commit, …).
   */
  specialTools?: Record<string, string>;
  /** Verb-level overrides; merged onto DEFAULT_VERBS. */
  verbs?: Record<string, VerbInfo>;
}

export interface BuiltinTool {
  /** Canonical display name, e.g. "Read", "Bash". */
  displayName: string;
  /** Stable grouping key (lowercase). Tools that share a key group together. */
  groupKey: string;
  category: string;
  icon: React.ReactNode;
  /**
   * Lowercased tool-name aliases that resolve to this builtin. Order matters —
   * earlier entries win when matched via prefix/contains rules.
   */
  aliases: string[];
  /**
   * `true` for tools that should always start a new group on their own
   * (Task, TaskCreate/TaskUpdate). Mirrors the legacy `isSpecial` behavior.
   */
  isSpecialGroup?: boolean;
}

/** Past-tense verb labels used for any vendor that doesn't override them. */
export const DEFAULT_VERBS: Record<string, VerbInfo> = {
  list: { label: "listed", icon: <Search className="size-3.5" /> },
  get: { label: "got", icon: <Read className="size-4" /> },
  fetch: { label: "fetched", icon: <Read className="size-4" /> },
  read: { label: "read", icon: <Read className="size-4" /> },
  search: { label: "searched", icon: <Search className="size-3.5" /> },
  research: { label: "researched", icon: <Search className="size-3.5" /> },
  save: { label: "saved", icon: <Edit className="size-3.5" /> },
  create: { label: "created", icon: <Plus className="size-4" /> },
  update: { label: "updated", icon: <Edit className="size-3.5" /> },
  delete: { label: "deleted", icon: <Trash className="size-3.5" /> },
  archive: { label: "archived", icon: <Trash className="size-3.5" /> },
  extract: { label: "extracted", icon: <Read className="size-4" /> },
  add: { label: "added", icon: <Plus className="size-4" /> },
  remove: { label: "removed", icon: <Trash className="size-3.5" /> },
  send: { label: "sent", icon: <SendMessage className="size-4" /> },
  run: { label: "ran", icon: <Bash className="size-4" /> },
  draft: { label: "drafted", icon: <Edit className="size-3.5" /> },
  reply: { label: "replied", icon: <SendMessage className="size-4" /> },
  open: { label: "opened", icon: <Read className="size-4" /> },
  close: { label: "closed", icon: <Trash className="size-3.5" /> },
};

/**
 * Vendor registry. Add a new MCP provider here — its tools will be parsed as
 * `{verb}_{entity}` automatically and rendered through `McpDisplay` without
 * any further wiring.
 */
export const VENDORS: VendorInfo[] = [
  {
    id: "mains",
    label: "Mains",
    category: "Review",
    prefixes: ["mcp__mains__"],
    icon: <Mains className="size-4" />,
    // These have specialized renderers in tool-call-item.tsx — keep their
    // displayNames stable so the dispatch keeps matching.
    specialTools: {
      getworkspacediff: "GetDiff",
      savereview: "SaveReview",
      savefinding: "SaveFinding",
      savefindings: "SaveFindings",
      commitchanges: "Commit",
      createpr: "CreatePR",
      checkpackage: "CheckPackage",
    },
  },
  {
    id: "github",
    label: "GitHub",
    category: "Git",
    prefixes: ["mcp__github__"],
    icon: <Github className="size-3.5" />,
  },
  {
    id: "linear",
    label: "Linear",
    category: "Project Management",
    prefixes: ["mcp__linear__", "mcp__codex_apps__linear"],
    icon: <Linear className="size-4" />,
  },
  {
    id: "figma",
    label: "Figma",
    category: "Design",
    prefixes: ["mcp__figma__", "mcp__codex_apps__figma_", "mcp__figma-remote-mcp__"],
    icon: <Figma className="size-3.5" />,
  },
  {
    id: "notion",
    label: "Notion",
    category: "Knowledge Base",
    prefixes: ["mcp__notion__", "mcp__codex_apps__notion_"],
    icon: <Notion className="size-4" />,
  },
  {
    id: "gmail",
    label: "Gmail",
    category: "Email",
    prefixes: ["mcp__gmail__", "mcp__codex_apps__gmail"],
    icon: <Gmail className="size-4" />,
  },
  {
    id: "google-calendar",
    label: "Google Calendar",
    category: "Calendar",
    prefixes: ["mcp__google-calendar__", "mcp__codex_apps__google calendar"],
    icon: <GoogleCalendar className="size-4" />,
  },
  {
    id: "slack",
    label: "Slack",
    category: "Communication",
    prefixes: ["mcp__slack__", "mcp__codex_apps__slack"],
    icon: <Slack className="size-4" />,
  },
  {
    id: "computer-use",
    label: "Computer use",
    category: "Computer Use",
    prefixes: ["mcp__computer-use__", "mcp__computer_use__"],
    icon: <BrowserCursor className="size-3.5" />,
  },
];

/**
 * Built-in (non-MCP) tools. Order is significant for the contains-fallback
 * resolution path — more specific aliases must come before less specific ones
 * (e.g. `webfetch` before `fetch`).
 */
export const BUILTIN_TOOLS: BuiltinTool[] = [
  // Task plan tools — claude_code emits TaskCreate (one call per item) +
  // TaskUpdate (taskId/status). They share the `task-plan` groupKey so
  // `stripTaskPlanEvents` strips them from the timeline and the
  // `TodoSummaryBar` aggregator picks them up as the source of truth.
  // TaskGet / TaskList are read-only queries → own keys, not isSpecialGroup.
  {
    displayName: "TaskCreate",
    groupKey: "task-plan",
    category: "Todo",
    icon: <Check className="size-4" />,
    aliases: ["taskcreate"],
    isSpecialGroup: true,
  },
  {
    displayName: "TaskUpdate",
    groupKey: "task-plan",
    category: "Todo",
    icon: <Check className="size-4" />,
    aliases: ["taskupdate"],
    isSpecialGroup: true,
  },
  {
    displayName: "TaskGet",
    groupKey: "taskget",
    category: "Todo",
    icon: <Read className="size-4" />,
    aliases: ["taskget"],
  },
  {
    displayName: "TaskList",
    groupKey: "tasklist",
    category: "Todo",
    icon: <Search className="size-3.5" />,
    aliases: ["tasklist"],
  },
  {
    displayName: "Task",
    groupKey: "task",
    category: "Agent",
    icon: <Task className="size-4" />,
    aliases: ["task"],
    isSpecialGroup: true,
  },
  {
    displayName: "Agent",
    groupKey: "agent",
    category: "Agent",
    icon: <Task className="size-4" />,
    aliases: ["agent"],
  },
  {
    displayName: "EnterPlanMode",
    groupKey: "enterplanmode",
    category: "Todo",
    icon: <EnterPlan className="size-4" />,
    aliases: ["enterplanmode"],
  },
  {
    displayName: "ExitPlanMode",
    groupKey: "exitplanmode",
    category: "Todo",
    icon: <ExitPlan className="size-4" />,
    aliases: ["exitplanmode"],
  },
  {
    displayName: "Plan",
    groupKey: "plan",
    category: "Todo",
    icon: <EnterPlan className="size-4" />,
    aliases: ["plan", "create plan"],
  },
  {
    displayName: "Skill",
    groupKey: "skill",
    category: "Skill",
    icon: <Sparkles className="size-4" />,
    aliases: ["skill"],
  },
  {
    displayName: "AskUserQuestion",
    groupKey: "askuserquestion",
    category: "Interaction",
    icon: <Question className="size-4" />,
    aliases: ["askuserquestion", "ask_user", "askuser"],
  },
  {
    displayName: "WebFetch",
    groupKey: "webfetch",
    category: "Search",
    icon: <Web className="size-4" />,
    aliases: ["webfetch", "web_fetch"],
  },
  {
    displayName: "WebSearch",
    groupKey: "websearch",
    category: "Search",
    icon: <Web className="size-4" />,
    aliases: ["websearch", "web_search"],
  },
  {
    displayName: "ToolSearch",
    groupKey: "toolsearch",
    category: "Search",
    icon: <Search className="size-3.5" />,
    aliases: ["toolsearch"],
  },
  {
    displayName: "Intent",
    groupKey: "intent",
    category: "Agent",
    icon: <Sparkles className="size-4" />,
    aliases: ["report_intent"],
  },
  {
    displayName: "Read",
    groupKey: "read",
    category: "File",
    icon: <Read className="size-4" />,
    aliases: ["read", "read_file"],
  },
  {
    displayName: "View",
    groupKey: "view",
    category: "File",
    icon: <Document className="size-4" />,
    aliases: ["view"],
  },
  {
    displayName: "Edit",
    groupKey: "edit",
    category: "File",
    icon: <Edit className="size-3.5" />,
    aliases: ["edit", "replace", "edit_file"],
  },
  {
    displayName: "Write",
    groupKey: "write",
    category: "File",
    icon: <Edit className="size-3.5" />,
    aliases: ["write", "writeifempty", "create_file", "write_file"],
  },
  {
    displayName: "Delete",
    groupKey: "delete",
    category: "File",
    icon: <Trash className="size-3.5" />,
    aliases: ["delete", "delete_file"],
  },
  {
    displayName: "Bash",
    groupKey: "bash",
    category: "Shell",
    icon: <Bash className="size-4" />,
    aliases: ["bash", "terminal"],
  },
  {
    displayName: "Shell",
    groupKey: "shell",
    category: "Shell",
    icon: <Bash className="size-4" />,
    aliases: ["shell"],
  },
  {
    displayName: "Glob",
    groupKey: "glob",
    category: "File",
    icon: <Glob className="size-4" />,
    aliases: ["glob", "find"],
  },
  {
    displayName: "Grep",
    groupKey: "grep",
    category: "Search",
    icon: <Grep className="size-3.5" />,
    aliases: ["grep"],
  },
  {
    displayName: "Search",
    groupKey: "search",
    category: "Search",
    icon: <Search className="size-3.5" />,
    aliases: ["search"],
  },
  {
    displayName: "Commit",
    groupKey: "commitchanges",
    category: "Code",
    icon: <Mains className="size-4" />,
    aliases: ["commitchanges"],
  },
  {
    displayName: "CreatePR",
    groupKey: "createpr",
    category: "Code",
    icon: <Mains className="size-4" />,
    aliases: ["createpr"],
  },
  {
    displayName: "CheckPackage",
    groupKey: "checkpackage",
    category: "Code",
    icon: <Mains className="size-4" />,
    aliases: ["checkpackage"],
  },
  {
    displayName: "SaveReview",
    groupKey: "savereview",
    category: "Code",
    icon: <Mains className="size-4" />,
    aliases: ["savereview"],
  },
  {
    displayName: "SaveFinding",
    groupKey: "savefinding",
    category: "Code",
    icon: <Mains className="size-4" />,
    aliases: ["savefinding"],
  },
  {
    displayName: "SaveFindings",
    groupKey: "savefindings",
    category: "Code",
    icon: <Mains className="size-4" />,
    aliases: ["savefindings"],
  },
  {
    displayName: "GetDiff",
    groupKey: "getworkspacediff",
    category: "Code",
    icon: <Mains className="size-4" />,
    aliases: ["getworkspacediff"],
  },
];
