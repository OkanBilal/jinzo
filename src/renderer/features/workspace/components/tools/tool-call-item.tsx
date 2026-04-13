import type { RunEvent } from "../../types";
import { getToolInfo } from "../../utils/tool-categories";
import { parseToolContent } from "../../utils/parse-tool-content";
import { getToolType } from "../../utils/group-tool-calls";
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
import { ViewDisplay, type ViewParams } from "./view-display";
import { ToolSearchDisplay, type ToolSearchParams } from "./tool-search-display";
import { SkillDisplay, type SkillParams } from "./skill-display";
import { AskUserQuestionDisplay, type AskUserQuestionParams } from "./ask-user-question-display";
import { WebFetchDisplay, type WebFetchParams } from "./web-fetch-display";

interface ToolCallItemProps {
  event: RunEvent;
  isCompact?: boolean;
}

export function ToolCallItem({ event, isCompact = true }: ToolCallItemProps) {
  const { toolName, params, summary } = parseToolContent(event.content);
  const displayName = getToolType(event.content);
  const { icon } = getToolInfo(displayName);

  if (toolName.toLowerCase() === "todowrite") {
    // First try to get todos from metadata (raw input from hook)
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const todos = metadataInput?.todos ?? params?.todos;
    if (todos && Array.isArray(todos)) {
      return <TodoListDisplay todos={todos as TodoItem[]} />;
    }
  }

  // Show PlanDisplay for Plan / Create Plan tool calls
  if (toolName.toLowerCase() === "plan" || toolName.toLowerCase() === "create plan") {
    return <PlanDisplay event={event} />;
  }

  // Show PlanDisplay for ExitPlanMode tool calls
  if (toolName.toLowerCase() === "exitplanmode") {
    return <PlanDisplay event={event} />;
  }

  // Show TaskDisplay for task tool calls - prefer metadata.input over parsed content
  if (toolName.toLowerCase() === "task") {
    // First try to get params from metadata (raw input from hook)
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const taskParams: TaskParams = metadataInput
      ? (metadataInput as TaskParams)
      : params
        ? (params as TaskParams)
        : { description: summary };
    return <TaskDisplay params={taskParams} />;
  }

  // Show AgentDisplay for agent tool calls
  if (toolName.toLowerCase() === "agent") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const agentParams: AgentParams = metadataInput
      ? (metadataInput as AgentParams)
      : params
        ? (params as AgentParams)
        : { description: summary };
    return <AgentDisplay params={agentParams} />;
  }

  // Show EditDisplay for edit tool calls
  if (toolName.toLowerCase() === "edit" || toolName.toLowerCase() === "replace") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const editParams: EditParams = metadataInput
      ? (metadataInput as EditParams)
      : params
        ? (params as EditParams)
        : { file_path: summary };
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
    return <WriteDisplay params={writeParams} />;
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
    return <IntentDisplay params={intentParams} />;
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
  if (toolName.toLowerCase() === "askuserquestion") {
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

  // Show WebFetchDisplay for web fetch tool calls
  if (toolName.toLowerCase() === "webfetch" || toolName.toLowerCase() === "web_fetch") {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const fetchParams: WebFetchParams = metadataInput
      ? (metadataInput as WebFetchParams)
      : params
        ? (params as WebFetchParams)
        : { url: summary };
    return <WebFetchDisplay params={fetchParams} output={event.metadata?.output} isCompact={isCompact} />;
  }

  // Show GetDiffDisplay for Jinzo GetDiff tool calls
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

  // Show PersistReviewDisplay for Jinzo SaveReview tool calls
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

  // Show PersistFindingDisplay for Jinzo SaveFinding/SaveFindings tool calls
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

  // Show CommitDisplay for Jinzo CommitChanges tool calls
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

  // Show PRDisplay for Jinzo CreatePR tool calls
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

  // Show CheckPackageDisplay for Jinzo CheckPackage tool calls
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

  // Show McpDisplay for MCP tool calls with expandable params
  if (
    displayName.endsWith("Mcp") ||
    displayName === "Jinzo" ||
    displayName === "Linear" ||
    displayName === "Notion" ||
    displayName === "Figma"
  ) {
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const mcpParams = metadataInput ?? params;
    return <McpDisplay displayName={displayName} params={mcpParams} />;
  }

  if (isCompact) {
    return (
      <div className="flex items-center gap-2 py-0.5 ml-5 px-2 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans">
        <span className="text-primary-500 truncate">{summary}</span>
      </div>
    );
  }

  return (
    <div className="py-0.5 px-2 hover:bg-primary-50 dark:hover:bg-primary/5 rounded">
      <div className="flex items-center gap-2 text-s font-sans">
        <span className="dark:text-primary-300">{icon}</span>
        <span className="dark:text-primary-300 font-medium">{displayName}</span>
        <span className="text-primary-500 truncate">{summary}</span>
      </div>
    </div>
  );
}
