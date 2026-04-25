import {
  Document,
  Search,
  Branch,
  Read,
  Edit,
  Bash,
  Check,
  ExitPlan,
  Task,
  Glob,
  Web,
  Question,
  EnterPlan,
  AgentTeams,
  SendMessage,
  TeamDelete,
  Linear,
  Notion,
  Figma,
  Mcp,
  Mains,
  Sparkles,
  Delete,
  Grep,
} from "@/components/ui/icons";

export const TOOL_CATEGORIES: Record<
  string,
  { category: string; icon: React.ReactNode }
> = {
  mains: {
    category: "Review",
    icon: <Mains className="size-3.5 " />,
  },
  getdiff: {
    category: "Review",
    icon: <Mains className="size-3.5 " />,
  },
  savereview: {
    category: "Review",
    icon: <Mains className="size-3.5" />,
  },
  savefindings: {
    category: "Review",
    icon: <Mains className="size-3.5  " />,
  },
  savefinding: {
    category: "Review",
    icon: <Mains className="size-3.5  " />,
  },
  commit: {
    category: "Git",
    icon: <Mains className="size-3.5" />,
  },
  createpr: {
    category: "Git",
    icon: <Mains className="size-3.5" />,
  },
  checkpackage: {
    category: "Guard",
    icon: <Mains className="size-3.5" />,
  },
  figma: {
    category: "Design",
    icon: <Figma className="size-4" />,
  },
  linear: {
    category: "Project Management",
    icon: <Linear className="size-4" />,
  },
  notion: {
    category: "Knowledge Base",
    icon: <Notion className="size-4" />,
  },
  listmcpresourcestool: {
    category: "MCP",
    icon: <Mcp className="size-4 " />,
  },
  read: {
    category: "File",
    icon: <Read className="size-4" />,
  },
  view: {
    category: "File",
    icon: <Document className="size-4" />,
  },
  write: {
    category: "File",
    icon: <Edit className="size-3.5" />,
  },
  edit: {
    category: "File",
    icon: <Edit className="size-3.5" />,
  },
  bash: {
    category: "Shell",
    icon: <Bash className="size-4" />,
  },
  grep: {
    category: "Search",
    icon: <Grep className="size-3.5" />,
  },
  glob: {
    category: "File",
    icon: <Glob className="size-4" />,
  },
  websearch: {
    category: "Search",
    icon: <Web className="size-4" />,
  },
  delete: {
    category: "File",
    icon: <Delete className="size-3.5" />,
  },
  webfetch: {
    category: "Search",
    icon: <Web className="size-4" />,
  },
  task: {
    category: "Agent",
    icon: <Task className="size-4" />,
  },
  todowrite: {
    category: "Todo",
    icon: <Check className="size-4" />,
  },
  enterplanmode: {
    category: "Todo",
    icon: <EnterPlan className="size-4" />,
  },
  create: {
    category: "General",
    icon: <EnterPlan className="size-4" />,
  },
  exitplanmode: {
    category: "Todo",
    icon: <ExitPlan className="size-4" />,
  },
  skill: {
    category: "Skill",
    icon: <Sparkles className="size-4" />,
  },
  askuserquestion: {
    category: "Interaction",
    icon: <Question className="size-4" />,
  },
  teamcreate: {
    category: "Agent",
    icon: <AgentTeams className="size-4" />,
  },
  sendmessage: {
    category: "Agent",
    icon: <SendMessage className="size-4" />,
  },
  teamdelete: {
    category: "Agent",
    icon: <TeamDelete className="size-4" />,
  },
  write_file: {
    category: "File",
    icon: <Document className="size-4" />,
  },
  edit_file: {
    category: "File",
    icon: <Edit className="size-3.5" />,
  },
  create_file: {
    category: "File",
    icon: <Document className="size-4" />,
  },
  shell: {
    category: "Shell",
    icon: <Bash className="size-4" />,
  },
  terminal: {
    category: "Shell",
    icon: <Bash className="size-4" />,
  },
  search: {
    category: "Search",
    icon: <Search className="size-3.5" />,
  },
  find: {
    category: "Search",
    icon: <Search className="size-4" />,
  },
  git_status: {
    category: "Git",
    icon: <Branch className="size-4" />,
  },
  git_diff: {
    category: "Git",
    icon: <Branch className="size-4" />,
  },
  web_fetch: {
    category: "Search",
    icon: <Web className="size-4" />,
  },
};

export function getToolInfo(toolName: string): {
  category: string;
  icon: React.ReactNode;
} {
  if (TOOL_CATEGORIES[toolName]) {
    return TOOL_CATEGORIES[toolName];
  }
  const lowerName = toolName.toLowerCase();
  for (const [key, value] of Object.entries(TOOL_CATEGORIES)) {
    if (lowerName.includes(key.toLowerCase())) {
      return value;
    }
  }

  return {
    category: "Tool",
    icon: <Mains className=" size-4" />,
  };
}
