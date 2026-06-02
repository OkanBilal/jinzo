import type { ReactNode } from "react";
import type { RunEvent } from "../../types";
import { parseToolContent, type ParsedToolContent } from "../../utils/parse-tool-content";
import { resolveTool } from "../../utils/resolve-tool";
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
import { SpawnAgentDisplay } from "./spawn-agent-display";
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

interface Ctx {
  toolNameLower: string;
  displayName: string;
  icon: ReactNode;
  resolved: ReturnType<typeof resolveTool>;
  metadataInput: Record<string, unknown> | undefined;
  params: Record<string, unknown> | null;
  summary: string;
  event: RunEvent;
  isCompact: boolean;
}

type Renderer = (ctx: Ctx) => ReactNode | null;

function pickParams<T>(ctx: Ctx, fallback: T): T {
  if (ctx.metadataInput) return ctx.metadataInput as T;
  if (ctx.params) return ctx.params as T;
  return fallback;
}

function hasMeaningfulOutput(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

/** Codex AgentControl collab tool calls — single SpawnAgentDisplay dispatches by toolName. */
const COLLAB_TOOL_NAMES = new Set([
  "spawnagent",
  "sendcollabinput",
  "waitcollabagent",
  "closecollabagent",
  "resumecollabagent",
]);

/**
 * Match toolNameLower ∈ names, render `<Display params output isCompact />`.
 * `buildFallback` runs only when neither metadata.input nor parsed params are present.
 */
function withOutput<T>(
  names: readonly string[],
  Display: React.ComponentType<{ params: T; output?: unknown; isCompact?: boolean }>,
  buildFallback: (ctx: Ctx) => T,
): Renderer {
  const renderer: Renderer = function renderWithOutput(ctx) {
    if (!names.includes(ctx.toolNameLower)) return null;
    const params = pickParams<T>(ctx, buildFallback(ctx));
    return <Display params={params} output={ctx.event.metadata?.output} isCompact={ctx.isCompact} />;
  };
  return renderer;
}

/** Same as `withOutput` but for displays that don't accept an `output` prop. */
function noOutput<T>(
  names: readonly string[],
  Display: React.ComponentType<{ params: T; isCompact?: boolean }>,
  buildFallback: (ctx: Ctx) => T,
): Renderer {
  const renderer: Renderer = function renderNoOutput(ctx) {
    if (!names.includes(ctx.toolNameLower)) return null;
    const params = pickParams<T>(ctx, buildFallback(ctx));
    return <Display params={params} isCompact={ctx.isCompact} />;
  };
  return renderer;
}

/** Mains-style tools resolve to a PascalCase `displayName` and use an empty-object fallback. */
function byDisplayName<T>(
  name: string,
  render: (ctx: Ctx, params: T) => ReactNode,
): Renderer {
  const renderer: Renderer = function renderByDisplayName(ctx) {
    if (ctx.displayName !== name) return null;
    return render(ctx, pickParams<T>(ctx, {} as T));
  };
  return renderer;
}

const summaryAs = (key: string) => (ctx: Ctx) => ({ [key]: ctx.summary }) as never;

const DISPATCH: Renderer[] = [
  // Plan / ExitPlanMode — PlanDisplay needs the raw event, not params.
  (ctx) =>
    ctx.toolNameLower === "plan" ||
    ctx.toolNameLower === "create plan" ||
    ctx.toolNameLower === "exitplanmode"
      ? <PlanDisplay event={ctx.event} />
      : null,

  // Codex AgentControl collab — all 5 variants share SpawnAgentDisplay.
  (ctx) =>
    COLLAB_TOOL_NAMES.has(ctx.toolNameLower)
      ? <SpawnAgentDisplay output={ctx.event.metadata?.output} toolName={ctx.toolNameLower} />
      : null,

  noOutput<TaskParams>(["task"], TaskDisplay, (ctx) => ({ description: ctx.summary })),
  noOutput<AgentParams>(["agent"], AgentDisplay, (ctx) => ({ description: ctx.summary })),

  withOutput<EditParams>(["edit", "replace"], EditDisplay, summaryAs("file_path")),

  // WriteDisplay is the odd one — accepts `output` but not `isCompact`.
  (ctx) => {
    if (!["write", "writeifempty", "create_file", "create"].includes(ctx.toolNameLower)) return null;
    const params = pickParams<WriteParams>(ctx, { file_path: ctx.summary });
    return <WriteDisplay params={params} output={ctx.event.metadata?.output} />;
  },

  withOutput<BashParams>(["bash", "shell"], BashDisplay, summaryAs("command")),
  withOutput<GlobParams>(["glob", "find"], GlobDisplay, summaryAs("pattern")),
  withOutput<GrepParams>(["grep", "search"], GrepDisplay, summaryAs("pattern")),
  withOutput<ReadParams>(["read"], ReadDisplay, summaryAs("file_path")),
  withOutput<DeleteParams>(["delete"], DeleteDisplay, summaryAs("file_path")),
  withOutput<ViewParams>(["view"], ViewDisplay, summaryAs("path")),
  noOutput<IntentParams>(["report_intent"], IntentDisplay, summaryAs("intent")),
  withOutput<ToolSearchParams>(["toolsearch"], ToolSearchDisplay, summaryAs("query")),
  noOutput<SkillParams>(["skill"], SkillDisplay, summaryAs("skill")),
  withOutput<AskUserQuestionParams>(
    ["askuserquestion", "ask_user", "askuser"],
    AskUserQuestionDisplay,
    summaryAs("question"),
  ),
  withOutput<WebFetchParams>(
    ["webfetch", "web_fetch", "websearch"],
    WebFetchDisplay,
    (ctx) =>
      ctx.toolNameLower === "websearch"
        ? { query: ctx.summary }
        : { url: ctx.summary },
  ),

  byDisplayName<GetDiffParams>("GetDiff", (ctx, params) => (
    <GetDiffDisplay params={params} output={ctx.event.metadata?.output} isCompact={ctx.isCompact} />
  )),
  byDisplayName<SaveReviewParams>("SaveReview", (ctx, params) => (
    <SaveReviewDisplay params={params} isCompact={ctx.isCompact} />
  )),
  byDisplayName<SaveFindingParams>("SaveFinding", (ctx, params) => (
    <SaveFindingDisplay params={params} isCompact={ctx.isCompact} />
  )),
  byDisplayName<SaveFindingParams>("SaveFindings", (ctx, params) => (
    <SaveFindingDisplay params={params} isCompact={ctx.isCompact} />
  )),
  byDisplayName<CommitParams>("Commit", (ctx, params) => (
    <CommitDisplay params={params} isCompact={ctx.isCompact} />
  )),
  byDisplayName<PRParams>("CreatePR", (ctx, params) => (
    <PRDisplay params={params} isCompact={ctx.isCompact} />
  )),
  byDisplayName<CheckPackageParams>("CheckPackage", (ctx, params) => (
    <CheckPackageDisplay params={params} output={ctx.event.metadata?.output} isCompact={ctx.isCompact} />
  )),

  // Generic MCP fallback — the resolver tags any vendor-mapped tool (Linear, GitHub,
  // Figma, Notion, computer-use, Mains-without-special-renderer, …) with `vendorId`,
  // so we don't need a brittle string-includes chain.
  (ctx) => {
    if (ctx.resolved.vendorId === undefined) return null;
    return (
      <McpDisplay
        displayName={ctx.displayName}
        icon={ctx.icon}
        params={ctx.metadataInput ?? ctx.params}
        output={ctx.event.metadata?.output}
        isCompact={ctx.isCompact}
      />
    );
  },
];

export function ToolCallItem({ event, isCompact = true }: ToolCallItemProps) {
  // Mapper memoizes the parse on metadata.parsed; fall back for legacy events
  // (e.g. streaming artifacts that never went through `mapToolCallToEvent`).
  const { toolName, params, summary } =
    (event.metadata?.parsed as ParsedToolContent | undefined) ??
    parseToolContent(event.content);
  const metadataInput = event.metadata?.input as
    | Record<string, unknown>
    | undefined;
  const resolved = resolveTool(event.content);

  const hasParamsOrInput =
    (params !== null && Object.keys(params).length > 0) ||
    (metadataInput !== undefined && Object.keys(metadataInput).length > 0);
  const hasSummary = Boolean(summary?.trim());
  const isEmptyTool =
    !hasParamsOrInput && !hasSummary && !hasMeaningfulOutput(event.metadata?.output);

  if (isEmptyTool) {
    if (isCompact) {
      return (
        <div className="flex items-center gap-1 px-1 text-s font-sans">
          <span className="text-primary-500/60 shrink-0" />
        </div>
      );
    }
    return (
      <div className=" ">
        <div className="flex items-center gap-1 text-s font-sans">
          <span className="text-primary-500/60 group-hover:text-primary-900 group-hover:dark:text-primary-200">
            {resolved.icon}
          </span>
          <span className="text-primary-500/60 group-hover:text-primary-900 group-hover:dark:text-primary-200 font-medium">
            {resolved.displayName}
          </span>
          <span className="text-primary-500/60 italic truncate" />
        </div>
      </div>
    );
  }

  const ctx: Ctx = {
    toolNameLower: toolName.toLowerCase(),
    displayName: resolved.displayName,
    icon: resolved.icon,
    resolved,
    metadataInput,
    params,
    summary,
    event,
    isCompact,
  };

  for (const renderer of DISPATCH) {
    const node = renderer(ctx);
    if (node !== null) return node;
  }

  if (isCompact) {
    return (
      <div className="flex items-center gap-2 py-0.5 ml-5 px-2 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans">
        <span className="text-primary-500 truncate">{summary}</span>
      </div>
    );
  }

  return (
    <div className="py-0.5 text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary  rounded">
      <div className="flex items-center gap-2 text-s font-sans">
        <span className="">
          {resolved.icon}
        </span>
        <span className=" font-medium">
          {resolved.displayName}
        </span>
        <span className=" truncate">{summary}</span>
      </div>
    </div>
  );
}
