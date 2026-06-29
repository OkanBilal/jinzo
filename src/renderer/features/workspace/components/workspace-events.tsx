import { Fragment, type ReactNode, RefObject, useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  ToolCallGroup,
  InfoGroup,
  groupEvents,
  reconcileEventGroups,
  isPlanToolCallGroup,
  type EventGroup,
} from "./tools/tool-call-group";
import { PlanDisplay } from "./tools/plan-display";
import { demoteStaleRunningTools } from "./tools/_shared";
import { EditorContent } from "./editor-content";
import { IssueTabContent } from "./issue-tab-content";
import { SignalTabContent } from "./signal-tab-content";
import { NoteTabContent } from "./note-tab-content";
import { WorkspaceEmptyState } from "./workspace-empty-state";
import type { Run, RunEvent, Workspace } from "../types";
import type { IssueWithEntity, SignalWithEntity, RunTurn, ModelUsageEntry } from "@/lib/redux/api";

const EMPTY_TURNS: RunTurn[] = [];
import { isIssueTab, getIssueEntityId, isSignalTab, getSignalEntityId, isNoteTab, getNoteId, isNewRunTab } from "../utils/repo-utils";
import { AsciiLoader } from "./ascii-loader";
import { Clipboard, Check, Branch, ArrowUp } from "@/components/ui/icons";
import { useGetAppSettingsQuery } from "@/lib/redux/api";
import { isDocumentRenderImage } from "@/lib/document-viewer";
import { Button, Tooltip } from "@/components/ui";
import { PromptSuggestionChips } from "./prompt-suggestion-chips";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${seconds}s`;
}

interface SessionInfo {
  elapsed: number;
  responseContent: string;
  turn?: RunTurn;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCost(micros: number): string {
  const usd = micros / 1_000_000;
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}


/** Single model usage block */
function ModelUsageBlock({ modelName, usage }: { modelName: string; usage: ModelUsageEntry }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xxs opacity-70 flex justify-between gap-4">
        <span>{modelName}</span>
        <span>${usage.costUSD.toFixed(4)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="opacity-60">Input</span>
        <span>{formatNumber(usage.inputTokens)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="opacity-60">Output</span>
        <span>{formatNumber(usage.outputTokens)}</span>
      </div>
      {usage.cacheReadInputTokens > 0 && (
        <div className="flex justify-between gap-4">
          <span className="opacity-60">Cache read</span>
          <span>{formatNumber(usage.cacheReadInputTokens)}</span>
        </div>
      )}
      {usage.cacheCreationInputTokens > 0 && (
        <div className="flex justify-between gap-4">
          <span className="opacity-60">Cache write</span>
          <span>{formatNumber(usage.cacheCreationInputTokens)}</span>
        </div>
      )}
    </div>
  );
}

/** Build rich usage content for the tooltip */
function UsageTooltipContent({ turn }: { turn: RunTurn }) {
  const modelEntries = turn.modelUsage ? Object.entries(turn.modelUsage) : [];
  const hasPerModel = modelEntries.length > 0;

  return (
    <div className="text-xs  space-y-1 min-w-44">

      {hasPerModel ? (
        <>
          {modelEntries.map(([name, usage], idx) => (
            <div key={name}>
              {idx > 0 && <div className="border-t border-current/15 my-1" />}
              <ModelUsageBlock modelName={name} usage={usage} />
            </div>
          ))}
        </>
      ) : (
        <>
          {turn.model && (
            <div className="text-xxs opacity-70 mb-1">{turn.model}</div>
          )}
          <div className="border-t border-current/15 pt-1 space-y-0.5">
            {turn.inputTokens != null && (
              <div className="flex justify-between gap-4">
                <span className="opacity-60">Input</span>
                <span>{formatNumber(turn.inputTokens)}</span>
              </div>
            )}
            {turn.outputTokens != null && (
              <div className="flex justify-between gap-4">
                <span className="opacity-60">Output</span>
                <span>{formatNumber(turn.outputTokens)}</span>
              </div>
            )}
            {turn.cacheReadTokens != null && (
              <div className="flex justify-between gap-4">
                <span className="opacity-60">Cache read</span>
                <span>{formatNumber(turn.cacheReadTokens)}</span>
              </div>
            )}
            {turn.cacheWriteTokens != null && (
              <div className="flex justify-between gap-4">
                <span className="opacity-60">Cache write</span>
                <span>{formatNumber(turn.cacheWriteTokens)}</span>
              </div>
            )}
          </div>
        </>
      )}
      {turn.costMicros != null && (
        <div className="border-t border-current/15 pt-1 flex justify-between gap-4 font-medium">
          <span className="opacity-60">Total</span>
          <span>{formatCost(turn.costMicros)}</span>
        </div>
      )}
    </div>
  );
}

/** Session time bar with dot separator, copy button, fork button, and usage tooltip */
function SessionTimeBar({
  info,
  onFork,
}: {
  info: SessionInfo;
  onFork?: (responseContent: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!info.responseContent) return;
    navigator.clipboard.writeText(info.responseContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [info.responseContent]);

  const handleFork = useCallback(() => {
    if (onFork) {
      onFork(info.responseContent);
    }
  }, [onFork, info.responseContent]);

  if (info.elapsed <= 0) return null;

  const turn = info.turn;
  const hasUsage = turn && (turn.inputTokens || turn.outputTokens || turn.cacheReadTokens || turn.cacheWriteTokens || turn.costMicros);

  return (
    <div className="flex items-center gap-2 text-s text-primary-700 dark:text-primary-400  -mt-1">
      {hasUsage ? (
        <Tooltip
          content={<UsageTooltipContent turn={turn} />}
          position="top-right"
          className="whitespace-normal max-w-none"
        >
          <span className="cursor-default">{formatElapsed(info.elapsed)}</span>
        </Tooltip>
      ) : (
        <span>{formatElapsed(info.elapsed)}</span>
      )}
      {info.responseContent && (
        <>
          <span className="size-0.75 rounded-full bg-current opacity-50" />
          <Button
            tooltip="Copy response"
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-primary-900 dark:hover:text-primary-100 transition-colors cursor-pointer"
            title="Copy response"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Clipboard className="size-3.5" />
            )}
          </Button>
        </>
      )}
      {onFork && (
        <>
          <Button
            tooltip="Fork run from here"
            onClick={handleFork}
            className="flex items-center gap-1 ml-0.5 hover:text-primary-900 dark:hover:text-primary-100 transition-colors cursor-pointer"
            title="Fork run from here"
          >
            <Branch className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}

/** Join `content` from every `response` group in [fromIdx, toIdx] (inclusive, clamped). */
function collectResponseContent(
  groups: EventGroup[],
  fromIdx: number,
  toIdx: number,
): string {
  const parts: string[] = [];
  const end = Math.min(toIdx, groups.length - 1);
  for (let j = fromIdx; j <= end; j++) {
    if (groups[j]?.type === "response") {
      for (const event of groups[j].events) {
        if (event.content) parts.push(event.content);
      }
    }
  }
  return parts.join("\n\n");
}

/**
 * Match backend turns to event group indices.
 * For each completed turn, find the last event group whose endTime falls
 * within that turn's time range, or the closest group before the next turn.
 */
function matchTurnsToGroups(
  groups: EventGroup[],
  turns: RunTurn[],
  runStartedAt?: Date,
  isRunCompleted?: boolean,
): Map<number, SessionInfo> {
  const result = new Map<number, SessionInfo>();

  if (turns.length === 0) {
    // Fallback: no turns from backend yet — compute from events like before
    return computeSessionTimesFromEvents(groups, runStartedAt, isRunCompleted);
  }

  // For each turn, find the group range and place the session bar
  let lastGroupIdx = 0;
  for (const turn of turns) {
    if (turn.status !== "completed" || !turn.elapsedMs || turn.elapsedMs <= 0) continue;

    // Find the best group index for this turn's end time
    const turnEndMs = turn.endedAt
      ? new Date(turn.endedAt).getTime()
      : null;

    let bestIdx = lastGroupIdx;
    if (turnEndMs) {
      // Timestamps from DB are in epoch seconds, but Date constructor handles both
      const endMs = turnEndMs < 1e12 ? turnEndMs * 1000 : turnEndMs;
      for (let i = lastGroupIdx; i < groups.length; i++) {
        const groupEndMs = new Date(groups[i].endTime).getTime();
        if (groupEndMs <= endMs) {
          bestIdx = i;
        } else {
          break;
        }
      }
    } else {
      // No endedAt — find next user-prompt or use last group
      for (let i = lastGroupIdx + 1; i < groups.length; i++) {
        const isUserPrompt =
          groups[i].type === "info" &&
          groups[i].events[0]?.metadata?.kind === "user-prompt";
        if (isUserPrompt) {
          bestIdx = i - 1;
          break;
        }
        bestIdx = i;
      }
    }

    // Skip if this group is a user-prompt itself
    const groupAtBest = groups[bestIdx];
    if (groupAtBest?.type === "info" && groupAtBest.events[0]?.metadata?.kind === "user-prompt") {
      if (bestIdx > 0) bestIdx--;
    }

    result.set(bestIdx, {
      elapsed: turn.elapsedMs,
      responseContent:
        turn.responseContent || collectResponseContent(groups, lastGroupIdx, bestIdx),
      turn,
    });

    lastGroupIdx = bestIdx + 1;
  }

  return result;
}

/**
 * Fallback: compute session times from events (for runs that don't have turns yet).
 */
function computeSessionTimesFromEvents(
  groups: EventGroup[],
  runStartedAt?: Date,
  isRunCompleted?: boolean,
): Map<number, SessionInfo> {
  const result = new Map<number, SessionInfo>();
  let turnStartMs: number | null = runStartedAt
    ? new Date(runStartedAt).getTime()
    : null;
  let turnStartIdx = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const isUserPrompt =
      group.type === "info" &&
      group.events[0]?.metadata?.kind === "user-prompt";
    const isStatus =
      group.type === "info" && group.events[0]?.type === "status";

    if (isUserPrompt && turnStartMs !== null && i > 0) {
      const prevGroup = groups[i - 1];
      const prevIsPromptOrStatus =
        prevGroup.type === "info" &&
        (prevGroup.events[0]?.metadata?.kind === "user-prompt" ||
          prevGroup.events[0]?.type === "status");
      if (!prevIsPromptOrStatus) {
        const elapsed =
          new Date(prevGroup.endTime).getTime() - turnStartMs;
        if (elapsed > 0) {
          result.set(i - 1, {
            elapsed,
            responseContent: collectResponseContent(groups, turnStartIdx, i - 1),
          });
        }
      }
    }

    if (isUserPrompt || isStatus) {
      turnStartMs = new Date(group.startTime).getTime();
      turnStartIdx = i;
    }
  }

  if (isRunCompleted && turnStartMs !== null && groups.length > 0) {
    const lastIdx = groups.length - 1;
    const lastGroup = groups[lastIdx];
    const lastIsPromptOrStatus =
      lastGroup.type === "info" &&
      (lastGroup.events[0]?.metadata?.kind === "user-prompt" ||
        lastGroup.events[0]?.type === "status");
    if (!lastIsPromptOrStatus) {
      const elapsed = new Date(lastGroup.endTime).getTime() - turnStartMs;
      if (elapsed > 0) {
        result.set(lastIdx, {
          elapsed,
          responseContent: collectResponseContent(groups, turnStartIdx, lastIdx),
        });
      }
    }
  }

  return result;
}

function isUserPromptGroup(g: EventGroup): boolean {
  return g.type === "info" && g.events[0]?.metadata?.kind === "user-prompt";
}

function expandIndexRange(r: { start: number; end: number }): number[] {
  const out: number[] = [];
  for (let i = r.start; i <= r.end; i++) out.push(i);
  return out;
}

/** Total tool_call events in grouped UI ranges (collapsed accordion preview). */
function countToolCallsInRanges(groups: EventGroup[], ranges: number[][]): number {
  let n = 0;
  for (const range of ranges) {
    for (const i of range) {
      const g = groups[i];
      if (g?.type !== "tool_calls") continue;
      for (const ev of g.events) {
        if (ev.type === "tool_call") n++;
      }
    }
  }
  return n;
}

function formatAccordionToolSummary(total: number): string {
  if (total <= 0) return "";
  return total === 1 ? "1 tool call" : `${total} tool calls`;
}

/**
 * Within one agent turn (content after a user message until the next user message),
 * split into: optional non-response prefix chunks, then segments each starting with a response
 * artifact and running until the next response (tools, status, suggestions, etc. stay attached).
 */
function partitionAgentTurn(
  groups: EventGroup[],
  turnStart: number,
  turnEnd: number,
): { prefix: Array<{ start: number; end: number }>; segments: Array<{ start: number; end: number }> } {
  const prefix: Array<{ start: number; end: number }> = [];
  const segments: Array<{ start: number; end: number }> = [];
  let i = turnStart;
  while (i <= turnEnd) {
    if (groups[i].type !== "response") {
      const pStart = i;
      while (i <= turnEnd && groups[i].type !== "response") i++;
      prefix.push({ start: pStart, end: i - 1 });
      continue;
    }
    const segStart = i;
    let segEnd = i;
    i++;
    while (i <= turnEnd && groups[i].type !== "response") {
      segEnd = i;
      i++;
    }
    segments.push({ start: segStart, end: segEnd });
  }
  return { prefix, segments };
}

type TurnRenderRow =
  | { kind: "flat"; indices: number[] }
  | {
      kind: "accordion";
      previousSegments: number[][];
      /** Plan tool groups — pulled out of `previousSegments` so they stay outside the collapsed bucket. */
      planBreakoutIndices: number[];
      /** Groups containing image/document artifacts — kept visible so generated media aren't hidden behind the accordion. */
      messageBreakoutIndices: number[];
      lastSegment: number[];
      previousMessageCount: number;
      previousToolSummary: string;
    };

function groupHasMediaArtifact(g: EventGroup): boolean {
  return g.events.some(
    (e) =>
      e.type === "artifact" &&
      (e.metadata?.kind === "image" || e.metadata?.kind === "document"),
  );
}

/** Linear plan: every group index appears exactly once, in order. */
function buildTurnRenderRows(groups: EventGroup[]): TurnRenderRow[] {
  const rows: TurnRenderRow[] = [];
  let idx = 0;
  while (idx < groups.length) {
    if (isUserPromptGroup(groups[idx])) {
      rows.push({ kind: "flat", indices: [idx] });
      idx++;
      continue;
    }
    const turnStart = idx;
    while (idx < groups.length && !isUserPromptGroup(groups[idx])) idx++;
    const turnEnd = idx - 1;
    if (turnStart > turnEnd) continue;

    const { prefix, segments } = partitionAgentTurn(groups, turnStart, turnEnd);
    const prefixIndices = prefix.flatMap(expandIndexRange);

    if (segments.length === 0) {
      for (const p of prefix) {
        rows.push({ kind: "flat", indices: expandIndexRange(p) });
      }
      continue;
    }

    if (segments.length === 1) {
      rows.push({
        kind: "flat",
        indices: [...prefixIndices, ...expandIndexRange(segments[0]!)],
      });
      continue;
    }

    // Accordion only merges groups that start with `response`; tool blocks before the first
    // reply were emitted as separate "prefix" rows. Fold them into the first collapsed chunk.
    const prevRanges = segments.slice(0, -1).map(expandIndexRange);
    if (prefixIndices.length > 0) {
      prevRanges[0] = [...prefixIndices, ...prevRanges[0]!];
    }

    // Plan (PlanDisplay) must stay out of the collapsed region so Apply / Dismiss stay usable.
    // Image/document artifacts also stay outside — generated media shouldn't be hidden behind the accordion.
    const planBreakout: number[] = [];
    const messageBreakout: number[] = [];
    for (const range of prevRanges) {
      for (const gIdx of range) {
        const g = groups[gIdx]!;
        if (isPlanToolCallGroup(g)) {
          planBreakout.push(gIdx);
        } else if (groupHasMediaArtifact(g)) {
          messageBreakout.push(gIdx);
        }
      }
    }
    planBreakout.sort((a, b) => a - b);
    messageBreakout.sort((a, b) => a - b);
    const breakoutSet = new Set([...planBreakout, ...messageBreakout]);
    const filteredPrevRanges = prevRanges
      .map((range) => range.filter((gIdx) => !breakoutSet.has(gIdx)))
      .filter((range) => range.length > 0);

    if (filteredPrevRanges.length === 0) {
      rows.push({
        kind: "flat",
        indices: [
          ...messageBreakout,
          ...planBreakout,
          ...expandIndexRange(segments[segments.length - 1]!),
        ],
      });
      continue;
    }

    const toolTotal = countToolCallsInRanges(groups, filteredPrevRanges);
    let visibleMessageCount = 0;
    for (const range of filteredPrevRanges) {
      for (const gIdx of range) {
        if (groups[gIdx]?.type === "response") visibleMessageCount++;
      }
    }
    rows.push({
      kind: "accordion",
      previousSegments: filteredPrevRanges,
      planBreakoutIndices: planBreakout,
      messageBreakoutIndices: messageBreakout,
      lastSegment: expandIndexRange(segments[segments.length - 1]!),
      previousMessageCount: visibleMessageCount,
      previousToolSummary: formatAccordionToolSummary(toolTotal),
    });
  }
  return rows;
}

/**
 * Group `displayEvents` and reconcile against the previous result, so unchanged
 * groups keep referential identity across streamed tokens (see
 * `reconcileEventGroups`). The output is fully determined by `displayEvents`, so
 * the render-phase ref here is an idempotent memoization cell — the React-blessed
 * use of refs during render for caching. The lint rule is conservative about ref
 * reads in render, hence the scoped disable.
 */
/* eslint-disable react-hooks/refs */
function useReconciledGroups(displayEvents: RunEvent[]): EventGroup[] {
  const prevGroupsRef = useRef<EventGroup[] | null>(null);
  return useMemo(() => {
    const reconciled = reconcileEventGroups(
      prevGroupsRef.current,
      groupEvents(displayEvents),
    );
    prevGroupsRef.current = reconciled;
    return reconciled;
  }, [displayEvents]);
}
/* eslint-enable react-hooks/refs */

/** `isRunInProgress`: true only when this row is the last render row while the run is active (see map). */
function AgentTurnMessagesAccordion({
  previousSegments,
  planBreakoutIndices,
  messageBreakoutIndices,
  lastSegment,
  previousMessageCount,
  previousToolSummary,
  renderGroup,
  isRunInProgress,
}: {
  previousSegments: number[][];
  planBreakoutIndices: number[];
  messageBreakoutIndices: number[];
  lastSegment: number[];
  previousMessageCount: number;
  previousToolSummary: string;
  renderGroup: (index: number) => ReactNode;
  isRunInProgress: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isRunInProgress) return;
    queueMicrotask(() => setOpen(false));
  }, [isRunInProgress]);

  const expanded = isRunInProgress || open;

  const messageLabel =
    previousMessageCount === 0
      ? ""
      : previousMessageCount === 1
        ? "1 message"
        : `${previousMessageCount} messages`;
  const parts = [messageLabel, previousToolSummary].filter(Boolean);
  const label = parts.length > 0 ? parts.join(" · ") : "tool calls";

  const previousInner = (
    <div className="space-y-4">
      {previousSegments.flatMap((range) =>
        range.map((i) => (
          <Fragment key={`acc-prev-${i}`}>{renderGroup(i)}</Fragment>
        )),
      )}
    </div>
  );

  return (
    <div className={`flex flex-col ${isRunInProgress ? "gap-0" : "gap-4"}`}>
      <div
        className={`grid transition-all duration-300 ease-out ${
          isRunInProgress ? "grid-rows-[0fr] opacity-0 pointer-events-none" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-b border-primary-200/50 dark:border-primary-800/50 pb-1">
            <Button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="group w-full flex flex-wrap items-center gap-x-1 gap-y-0.5 text-left text-s text-primary-600 dark:text-primary-400 font-sans cursor-pointer hover:text-primary-800 dark:hover:text-primary-200 transition-colors"
            >
              <span className="min-w-0 wrap-break-word">{label}</span>
              <ArrowUp
                className={`size-3.5 shrink-0 opacity-70 transition-transform duration-300 ease-out ${open ? "rotate-180" : "rotate-90"}`}
              />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div
          className={`grid transition-all duration-300 ease-out ${
            expanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="min-h-0 overflow-hidden">{previousInner}</div>
        </div>
        {messageBreakoutIndices.length > 0 && (
          <div className="space-y-4">
            {messageBreakoutIndices.map((i) => (
              <Fragment key={`acc-msg-${i}`}>{renderGroup(i)}</Fragment>
            ))}
          </div>
        )}
        {planBreakoutIndices.length > 0 && (
          <div className="space-y-4">
            {planBreakoutIndices.map((i) => (
              <Fragment key={`acc-plan-${i}`}>{renderGroup(i)}</Fragment>
            ))}
          </div>
        )}
        <div className="space-y-4">
          {lastSegment.map((i) => (
            <Fragment key={`acc-last-${i}`}>{renderGroup(i)}</Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

interface WorkspaceEventsProps {
  runs: Run[];
  activeTab: "editor" | string;
  currentEvents: RunEvent[];
  currentWorkspace: Workspace | null;
  eventsEndRef: RefObject<HTMLDivElement>;
  issueTabs: IssueWithEntity[];
  signalTabs?: SignalWithEntity[];
  turns?: RunTurn[];
  variant?: "copilot" | "claude" | "codex" | "cursor";
  onForkRun?: (sourceRunId: string, message: string) => Promise<string | null>;
  onSuggestionSelect?: (suggestion: string) => void;
  onApplyPlan?: () => void;
}

export function WorkspaceEvents({
  runs,
  activeTab,
  currentEvents,
  currentWorkspace,
  eventsEndRef,
  issueTabs,
  signalTabs = [],
  turns = EMPTY_TURNS,
  variant = "copilot",
  onForkRun,
  onSuggestionSelect,
  onApplyPlan,
}: WorkspaceEventsProps) {
  const isEditorActive = activeTab === "editor";
  const isIssueActive = isIssueTab(activeTab);
  const isSignalActive = isSignalTab(activeTab);
  const isNoteActive = isNoteTab(activeTab);
  const isNewRunActive = isNewRunTab(activeTab);
  const activeIssue = isIssueActive
    ? issueTabs.find((t) => t.issue.entityId === getIssueEntityId(activeTab))
    : null;
  const activeSignal = isSignalActive
    ? signalTabs.find((t) => t.signal.entityId === getSignalEntityId(activeTab))
    : null;
  const activeNoteId = isNoteActive ? getNoteId(activeTab) : null;
  const isRunTabActive =
    !isEditorActive && !isIssueActive && !isSignalActive && !isNoteActive && !isNewRunActive;
  const hasRunContent = isRunTabActive && currentEvents.length > 0;

  // Check if current run is still running
  const activeRun = runs.find((r) => r.id === activeTab);
  const isRunning =
    activeRun?.status === "running" || activeRun?.status === "queued";
  const isRunCompleted =
    activeRun?.status === "succeeded" ||
    activeRun?.status === "failed" ||
    activeRun?.status === "canceled";

  // Read showToolCalls setting
  const { data: appSettings } = useGetAppSettingsQuery();
  const showToolCalls = appSettings?.showToolCalls !== false;

  // Drop document-render preview images (e.g. the per-page PNGs emitted while
  // generating a .docx/.pptx) so a document run doesn't spam image cards. Only
  // applies when the run actually produced a document — pure image runs are
  // untouched.
  const displayEvents = useMemo(() => {
    const docPaths = currentEvents
      .filter((e) => e.type === "artifact" && e.metadata?.kind === "document")
      .map((e) => (e.metadata?.path as string | undefined) ?? "")
      .filter(Boolean);
    const filtered =
      docPaths.length === 0
        ? currentEvents
        : currentEvents.filter((e) => {
            if (e.type === "artifact" && e.metadata?.kind === "image") {
              const imgPath = (e.metadata?.path as string | undefined) ?? "";
              if (isDocumentRenderImage(imgPath, docPaths)) return false;
            }
            return true;
          });
    // Stop finished tools from spinning until the run-end sweep resolves their
    // status (providers don't all emit per-tool completions). Runs on the
    // display-ordered list so "later event" matches what the user actually sees.
    return demoteStaleRunningTools(filtered);
  }, [currentEvents]);

  // Group events for CLI-style display, reconciled so unchanged groups keep
  // their object identity across streamed tokens — that's what lets the memoized
  // InfoGroup / ToolCallGroup rows skip re-rendering while only the live
  // (changing) group updates.
  const allEventGroups = useReconciledGroups(displayEvents);

  // Filter out tool_calls groups when setting is off — except plan groups, which stay visible
  // so Apply / Dismiss remain accessible regardless of the toggle.
  const eventGroups = useMemo(
    () => showToolCalls
      ? allEventGroups
      : allEventGroups.filter((g) => g.type !== "tool_calls" || isPlanToolCallGroup(g)),
    [allEventGroups, showToolCalls],
  );

  // Session times: index-based map of "show session bar after this group index"
  const sessionTimes = useMemo(
    () => matchTurnsToGroups(eventGroups, turns, activeRun?.startedAt, isRunCompleted),
    [eventGroups, turns, activeRun?.startedAt, isRunCompleted],
  );

  // Last session time index — fork button only shown on the last one
  const lastSessionIndex = useMemo(() => {
    let last = -1;
    for (const idx of sessionTimes.keys()) {
      if (idx > last) last = idx;
    }
    return last;
  }, [sessionTimes]);

  // Last prompt_suggestion group index — only show if nothing comes after it
  // (i.e. no user-prompt or other content after the suggestion)
  const lastSuggestionIndex = useMemo(() => {
    let last = -1;
    for (let i = 0; i < eventGroups.length; i++) {
      if (eventGroups[i].type === "prompt_suggestion") last = i;
    }
    // If there's any non-suggestion group after the last suggestion,
    // it means the user already acted — hide the suggestion
    if (last !== -1) {
      for (let i = last + 1; i < eventGroups.length; i++) {
        if (eventGroups[i].type !== "prompt_suggestion") return -1;
      }
    }
    return last;
  }, [eventGroups]);

  const handleFork = useCallback(
    (_responseContent: string) => {
      if (!activeRun || !onForkRun) return;
      onForkRun(activeRun.id, "Continue from where this session left off.");
    },
    [activeRun, onForkRun],
  );

  const turnRenderRows = useMemo(
    () => buildTurnRenderRows(eventGroups),
    [eventGroups],
  );

  /** User messages grouped as `info` + user-prompt — must stay in sync with `turns` length when events are up to date. */
  const userPromptGroupCount = useMemo(
    () => eventGroups.reduce((n, g) => n + (isUserPromptGroup(g) ? 1 : 0), 0),
    [eventGroups],
  );

  /**
   * After `continueRun`, main creates a new active turn before user-prompt artifacts appear in the
   * event list. In that gap, the last render row can still be the *previous* turn's accordion; without
   * this guard, `isRunInProgress` would force it open.
   */
  const suppressLiveAccordionForStaleEvents = useMemo(() => {
    if (!isRunning || turns.length === 0) return false;
    return turns.length > userPromptGroupCount;
  }, [isRunning, turns.length, userPromptGroupCount]);

  const renderGroupAt = useCallback(
    (index: number) => {
      const group = eventGroups[index];
      if (!group) return null;
      const isLastSuggestion =
        group.type === "prompt_suggestion" &&
        onSuggestionSelect &&
        isRunCompleted &&
        index === lastSuggestionIndex;
      const sessionBarForThis = sessionTimes.has(index)
        ? sessionTimes.get(index)!
        : null;

      return (
        <Fragment key={group.id}>
          {group.type === "prompt_suggestion" ? (
            <>
              {sessionBarForThis && (
                <SessionTimeBar
                  info={sessionBarForThis}
                  onFork={index === lastSessionIndex && isRunCompleted && onForkRun ? handleFork : undefined}
                />
              )}
              {isLastSuggestion ? (
                <PromptSuggestionChips
                  suggestions={group.events.map((e) => e.content).filter(Boolean)}
                  onSelect={onSuggestionSelect}
                />
              ) : null}
            </>
          ) : group.type === "tool_calls" ? (
            group.events.length === 1 && (() => {
              const c = group.events[0].content;
              const ci = c.indexOf(":");
              const n = (ci !== -1 ? c.substring(0, ci).trim() : c).toLowerCase();
              return n === "plan" || n === "create plan" || n === "exitplanmode";
            })() ? (
              <PlanDisplay event={group.events[0]} onApplyPlan={onApplyPlan} />
            ) : (
              <ToolCallGroup
                group={group}
                defaultExpanded={index === eventGroups.length - 1}
                variant={variant}
              />
            )
          ) : (
            <InfoGroup group={group} workspaceRootPath={currentWorkspace?.rootPath} />
          )}
          {group.type !== "prompt_suggestion" && sessionBarForThis && (
            <SessionTimeBar
              info={sessionBarForThis}
              onFork={index === lastSessionIndex && isRunCompleted && onForkRun ? handleFork : undefined}
            />
          )}
        </Fragment>
      );
    },
    [
      eventGroups,
      onSuggestionSelect,
      isRunCompleted,
      lastSuggestionIndex,
      sessionTimes,
      lastSessionIndex,
      onForkRun,
      handleFork,
      variant,
      onApplyPlan,
      currentWorkspace?.rootPath,
    ],
  );

  // Latest thinking: ephemeral Cursor stream (cursor-think-*) or legacy persisted [thinking] logs
  const latestThinking = useMemo(() => {
    const reversed = [...currentEvents].reverse();
    const streamed = reversed.find(
      (e) => e.type === "artifact" && e.metadata?.kind === "thinking" && e.content.trim(),
    );
    if (streamed) return streamed.content;
    const last = reversed.find(
      (e) => e.type === "log" && e.content.startsWith("[thinking] "),
    );
    return last ? last.content.slice("[thinking] ".length) : undefined;
  }, [currentEvents]);

  // Run content stays mounted whenever there are events for the active run,
  // just hidden when a non-run tab is active. Preserves accordion open state,
  // scroll position, and other local UI state across tab switches.
  const showEmpty = isRunTabActive && currentEvents.length === 0;

  return (
    <div className=" text-sm h-full flex flex-col">
      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {isNewRunActive && (
          <div className="h-full min-h-0 shrink-0" aria-hidden />
        )}
        {isEditorActive && <EditorContent className="h-full" />}
        {isIssueActive && activeIssue && <IssueTabContent issue={activeIssue} />}
        {isSignalActive && activeSignal && <SignalTabContent signal={activeSignal} />}
        {isNoteActive && activeNoteId && <NoteTabContent reviewId={activeNoteId} />}
        {currentEvents.length > 0 && (
          <div
            className={`h-full overflow-y-auto noscrollbar ${isRunTabActive ? "" : "hidden"}`}
          >
            <div className="min-h-75 max-w-210 mx-auto space-y-4 pt-12 pb-24 px-4">
              {turnRenderRows.map((row, rowIndex) => {
                const isLastRow = rowIndex === turnRenderRows.length - 1;
                let rowKey: string;
                let content: ReactNode;
                if (row.kind === "flat") {
                  const first = row.indices[0];
                  const lastIdx = row.indices[row.indices.length - 1];
                  rowKey = `row-flat-${first}-${lastIdx}`;
                  content = row.indices.map((index) => renderGroupAt(index));
                } else {
                  const isLiveTurnAccordion =
                    isRunning && !suppressLiveAccordionForStaleEvents && isLastRow;
                  rowKey = `row-acc-${row.previousSegments[0]?.[0] ?? 0}-${row.planBreakoutIndices.join("-") || "x"}-${row.lastSegment[0] ?? 0}`;
                  content = (
                    <AgentTurnMessagesAccordion
                      previousSegments={row.previousSegments}
                      planBreakoutIndices={row.planBreakoutIndices}
                      messageBreakoutIndices={row.messageBreakoutIndices}
                      lastSegment={row.lastSegment}
                      previousMessageCount={row.previousMessageCount}
                      previousToolSummary={row.previousToolSummary}
                      renderGroup={renderGroupAt}
                      isRunInProgress={isLiveTurnAccordion}
                    />
                  );
                }
                // Skip layout/paint of off-screen historical rows. `contain-intrinsic-size:
                // auto …` lets the browser remember each row's real height once it has been
                // rendered, so scrolling back up doesn't jump. The live (last) row is always
                // on-screen via auto-scroll and is left uncontained, so the streaming/grow +
                // scroll-to-bottom path never interacts with containment.
                return (
                  <div
                    key={rowKey}
                    className={
                      isLastRow
                        ? "space-y-4"
                        : "space-y-4 [content-visibility:auto] [contain-intrinsic-size:auto_240px]"
                    }
                  >
                    {content}
                  </div>
                );
              })}
              {isRunning && <AsciiLoader thinkingText={latestThinking} />}
              <div ref={eventsEndRef} />
            </div>
          </div>
        )}
        {showEmpty && <WorkspaceEmptyState workspace={currentWorkspace} />}
        {/* Top/bottom fade overlays — only shown on run content (chat), not on editor/issue/note tabs.
            `hasRunContent` already excludes editor/issue/signal/note/new-run tabs, so no extra guards needed. */}
        {hasRunContent && (
          <>
            <div className="absolute top-0 left-0 right-0 h-6 bg-linear-to-b from-primary to-transparent dark:from-primary-950 dark:to-transparent pointer-events-none z-(--z-base)" />
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-primary to-transparent dark:from-primary-950 dark:to-transparent pointer-events-none" />
          </>
        )}
      </div>
    </div>
  );
}
