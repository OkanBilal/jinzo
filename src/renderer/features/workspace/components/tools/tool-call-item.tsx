import type { RunEvent } from "../../types";
import { parseToolContent } from "../../utils/parse-tool-content";
import { resolveTool } from "../../utils/resolve-tool";
import { TodoListDisplay, type TodoItem } from "./todo-list-display";
import { TaskDisplay, type TaskParams } from "./task-display";
import { PlanDisplay } from "./plan-display";
import { WriteDisplay, type WriteParams } from "./write-display";
import { McpDisplay } from "./mcp-display";
import { GetDiffDisplay, type GetDiffParams } from "./get-diff-display";
import { SaveReviewDisplay, type SaveReviewParams } from "./save-review-display";
import { CommitDisplay, type CommitParams } from "./commit-display";
import { PRDisplay, type PRParams } from "./pr-display";
import { CheckPackageDisplay, type CheckPackageParams } from "./check-package-display";
import { SaveFindingDisplay, type SaveFindingParams } from "./save-finding-display";
import { AgentDisplay, type AgentParams } from "./agent-display";
import { IntentDisplay, type IntentParams } from "./intent-display";
import { BashDisplay, type BashParams } from "./bash-display";
import { GlobDisplay, type GlobParams } from "./glob-display";
import { ReadDisplay, type ReadParams } from "./read-display";
import { GrepDisplay, type GrepParams } from "./grep-display";
import { EditDisplay, type EditParams } from "./edit-display";
import { DeleteDisplay, type DeleteParams } from "./delete-display";
import { ViewDisplay, type ViewParams } from "./view-display";
import { ToolSearchDisplay, type ToolSearchParams } from "./tool-search-display";
import { SkillDisplay, type SkillParams } from "./skill-display";
import { AskUserQuestionDisplay, type AskUserQuestionParams } from "./ask-user-question-display";
import { WebFetchDisplay, type WebFetchParams } from "./web-fetch-display";

interface ToolCallItemProps {
  event: RunEvent;
  isCompact?: boolean;
}

function getToolParams<T>(
  metadataInput: Record<string, unknown> | undefined,
  params: Record<string, unknown> | null,
  fallback: T,
): T {
  return metadataInput
    ? (metadataInput as T)
    : params
      ? (params as T)
      : fallback;
}

function hasMeaningfulOutput(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

export function ToolCallItem({ event, isCompact = true }: ToolCallItemProps) {
  const { toolName, params, summary } = parseToolContent(event.content);
  const toolNameLower = toolName.toLowerCase();
  const metadataInput = event.metadata?.input as
    | Record<string, unknown>
    | undefined;
  const resolved = resolveTool(event.content);
  const displayName = resolved.displayName;
  const icon = resolved.icon;

  const hasParamsOrInput =
    (params !== null && Object.keys(params).length > 0) ||
    (metadataInput !== undefined && Object.keys(metadataInput).length > 0);
  const hasSummary = Boolean(summary?.trim());
  const isEmptyTool =
    !hasParamsOrInput &&
    !hasSummary &&
    !hasMeaningfulOutput(event.metadata?.output);
  const emptyLabel = "";

  if (isEmptyTool) {
    if (isCompact) {
      return (
        <div className="flex items-center gap-1 px-1 text-s font-sans">
          <span className="text-primary-500/60 shrink-0">{emptyLabel}</span>
        </div>
      );
    }
    return (
      <div className=" ">
        <div className="flex items-center gap-1 text-s font-sans">
          <span className="text-primary-500/60 group-hover:text-primary-900 group-hover:dark:text-primary-200">{icon}</span>
          <span className="text-primary-500/60 group-hover:text-primary-900 group-hover:dark:text-primary-200 font-medium">
            {displayName}
          </span>
          <span className="text-primary-500/60 italic truncate">{emptyLabel}</span>
        </div>
      </div>
    );
  }

  if (toolNameLower === "todowrite") {
    const todos = metadataInput?.todos ?? params?.todos;
    if (todos && Array.isArray(todos)) {
      return <TodoListDisplay todos={todos as TodoItem[]} />;
    }
  }

  // Show PlanDisplay for Plan / Create Plan tool calls
  if (toolNameLower === "plan" || toolNameLower === "create plan") {
    return <PlanDisplay event={event} />;
  }

  // Show PlanDisplay for ExitPlanMode tool calls
  if (toolNameLower === "exitplanmode") {
    return <PlanDisplay event={event} />;
  }

  // Show TaskDisplay for task tool calls - prefer metadata.input over parsed content
  if (toolNameLower === "task") {
    const taskParams = getToolParams<TaskParams>(metadataInput, params, {
      description: summary,
    });
    return <TaskDisplay params={taskParams} isCompact={isCompact} />;
  }

  // Show AgentDisplay for agent tool calls
  if (toolNameLower === "agent") {
    const agentParams = getToolParams<AgentParams>(metadataInput, params, {
      description: summary,
    });
    return <AgentDisplay params={agentParams} isCompact={isCompact} />;
  }

  // Show EditDisplay for edit tool calls
  if (toolNameLower === "edit" || toolNameLower === "replace") {
    const editParams = getToolParams<EditParams>(metadataInput, params, {
      file_path: summary,
    });
    return <EditDisplay params={editParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show WriteDisplay for write/create file tool calls
  if (toolName.toLowerCase() === "write" || toolName.toLowerCase() === "writeifempty" || toolName.toLowerCase() === "create_file") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const writeParams: WriteParams = metadataInput
      ? (metadataInput as WriteParams)
      : params
        ? (params as WriteParams)
        : { file_path: summary };
    return <WriteDisplay params={writeParams} output={event.metadata?.output} />;
  }

  // Show BashDisplay for bash/shell tool calls
  if (toolName.toLowerCase() === "bash" || toolName.toLowerCase() === "shell") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const bashParams: BashParams = metadataInput
      ? (metadataInput as BashParams)
      : params
        ? (params as BashParams)
        : { command: summary };
    return <BashDisplay params={bashParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show GlobDisplay for glob/find tool calls
  if (toolName.toLowerCase() === "glob" || toolName.toLowerCase() === "find") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const globParams: GlobParams = metadataInput
      ? (metadataInput as GlobParams)
      : params
        ? (params as GlobParams)
        : { pattern: summary };
    return <GlobDisplay params={globParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show GrepDisplay for grep/search tool calls
  if (toolName.toLowerCase() === "grep" || toolName.toLowerCase() === "search") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const grepParams: GrepParams = metadataInput
      ? (metadataInput as GrepParams)
      : params
        ? (params as GrepParams)
        : { pattern: summary };
    return <GrepDisplay params={grepParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show ReadDisplay for read tool calls
  if (toolName.toLowerCase() === "read") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const readParams: ReadParams = metadataInput
      ? (metadataInput as ReadParams)
      : params
        ? (params as ReadParams)
        : { file_path: summary };
    return <ReadDisplay params={readParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show DeleteDisplay for delete file tool calls (e.g. Cursor ACP)
  if (toolNameLower === "delete") {
    const deleteParams = getToolParams<DeleteParams>(metadataInput, params, {
      file_path: summary,
    });
    return (
      <DeleteDisplay
        params={deleteParams}
        output={event.metadata?.output}
        isCompact={isCompact}
      />
    );
  }

  // Show ViewDisplay for Copilot view tool calls
  if (toolName.toLowerCase() === "view") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const viewParams: ViewParams = metadataInput
      ? (metadataInput as ViewParams)
      : params
        ? (params as ViewParams)
        : { path: summary };
    return <ViewDisplay params={viewParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show IntentDisplay for report_intent tool calls
  if (toolName.toLowerCase() === "report_intent") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const intentParams: IntentParams = metadataInput
      ? (metadataInput as IntentParams)
      : params
        ? (params as IntentParams)
        : { intent: summary };
    return <IntentDisplay params={intentParams} isCompact={isCompact} />;
  }

  // Show ToolSearchDisplay for ToolSearch tool calls
  if (toolName.toLowerCase() === "toolsearch") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const tsParams: ToolSearchParams = metadataInput
      ? (metadataInput as ToolSearchParams)
      : params
        ? (params as ToolSearchParams)
        : { query: summary };
    return <ToolSearchDisplay params={tsParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show SkillDisplay for Skill tool calls
  if (toolName.toLowerCase() === "skill") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const skillParams: SkillParams = metadataInput
      ? (metadataInput as SkillParams)
      : params
        ? (params as SkillParams)
        : { skill: summary };
    return <SkillDisplay params={skillParams} isCompact={isCompact} />;
  }

  // Show AskUserQuestionDisplay for interactive question tool calls
  // Claude: AskUserQuestion — Copilot/Codex SDK: ask_user
  if (
    toolNameLower === "askuserquestion" ||
    toolNameLower === "ask_user" ||
    toolNameLower === "askuser"
  ) {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const askParams: AskUserQuestionParams = metadataInput
      ? (metadataInput as AskUserQuestionParams)
      : params
        ? (params as AskUserQuestionParams)
        : { question: summary };
    return <AskUserQuestionDisplay params={askParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show WebFetchDisplay for web fetch (Copilot) and WebSearch (Codex: input.query, output "Searched: ...")
  if (
    toolName.toLowerCase() === "webfetch" ||
    toolName.toLowerCase() === "web_fetch" ||
    toolName.toLowerCase() === "websearch"
  ) {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const fetchParams: WebFetchParams = metadataInput
      ? (metadataInput as WebFetchParams)
      : params
        ? (params as WebFetchParams)
        : toolName.toLowerCase() === "websearch"
          ? { query: summary }
          : { url: summary };
    return <WebFetchDisplay params={fetchParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show GetDiffDisplay for Mains GetDiff tool calls
  if (displayName === "GetDiff") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const diffParams: GetDiffParams = metadataInput
      ? (metadataInput as GetDiffParams)
      : params
        ? (params as GetDiffParams)
        : {};
    return <GetDiffDisplay params={diffParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show PersistReviewDisplay for Mains SaveReview tool calls
  if (displayName === "SaveReview") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const reviewParams: SaveReviewParams = metadataInput
      ? (metadataInput as SaveReviewParams)
      : params
        ? (params as SaveReviewParams)
        : {};
    return <SaveReviewDisplay params={reviewParams} isCompact={isCompact} />;
  }

  // Show PersistFindingDisplay for Mains SaveFinding/SaveFindings tool calls
  if (displayName === "SaveFinding") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const findingParams: SaveFindingParams = metadataInput
      ? (metadataInput as SaveFindingParams)
      : params
        ? (params as SaveFindingParams)
        : {};
    return <SaveFindingDisplay params={findingParams} isCompact={isCompact} />;
  }

  // Show CommitDisplay for Mains CommitChanges tool calls
  if (displayName === "Commit") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const commitParams: CommitParams = metadataInput
      ? (metadataInput as CommitParams)
      : params
        ? (params as CommitParams)
        : {};
    return <CommitDisplay params={commitParams} isCompact={isCompact} />;
  }

  // Show PRDisplay for Mains CreatePR tool calls
  if (displayName === "CreatePR") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const prParams: PRParams = metadataInput
      ? (metadataInput as PRParams)
      : params
        ? (params as PRParams)
        : {};
    return <PRDisplay params={prParams} isCompact={isCompact} />;
  }

  // Show CheckPackageDisplay for Mains CheckPackage tool calls
  if (displayName === "CheckPackage") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const checkParams: CheckPackageParams = metadataInput
      ? (metadataInput as CheckPackageParams)
      : params
        ? (params as CheckPackageParams)
        : {};
    return <CheckPackageDisplay params={checkParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show McpDisplay for MCP tool calls with expandable params. The resolver
  // marks any tool that mapped to a vendor (Linear, GitHub, Figma, Notion,
  // Computer use, Mains-without-special-renderer, …) with `vendorId`, so we
  // don't need a brittle string-includes chain here.
  if (resolved.vendorId !== undefined) {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const mcpParams = metadataInput ?? params;
    return (
      <McpDisplay
        displayName={displayName}
        icon={icon}
        params={mcpParams}
        output={event.metadata?.output}
        isCompact={isCompact}
      />
    );
  }

  if (isCompact) {
    return (
      <div className="flex items-center gap-2 py-0.5 ml-5 px-2 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans">
        <span className="text-primary-500 truncate">{summary}</span>
      </div>
    );
  }

  return (
    <div className="py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded">
      <div className="flex items-center gap-2 text-s font-sans">
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">{icon}</span>
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary font-medium">{displayName}</span>
        <span className="text-primary-500 truncate">{summary}</span>
      </div>
    </div>
  );
}
