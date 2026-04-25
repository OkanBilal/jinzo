import { Fragment, RefObject, useMemo, useState, useCallback } from "react";
import { ToolCallGroup, InfoGroup, groupEvents, type EventGroup } from "./tools/tool-call-group";
import { PlanDisplay } from "./tools/plan-display";
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
import type { ToolApprovalRequest } from "../hooks/use-tool-approval";
import { ToolApprovalDialog } from "./tools/tool-approval-dialog";
import { Clipboard, Check, Branch } from "@/components/ui/icons";
import { useGetAppSettingsQuery } from "@/lib/redux/api";
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
              <Check className="size-4" />
            ) : (
              <Clipboard className="size-4" />
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

  // Build a list of turn boundaries using turn endedAt timestamps
  // For each completed turn, find the group index closest to endedAt
  const collectResponseContent = (fromIdx: number, toIdx: number): string => {
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
  };

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
      responseContent: turn.responseContent || collectResponseContent(lastGroupIdx, bestIdx),
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

  const collectResponseContent = (fromIdx: number, toIdx: number): string => {
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
  };

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
            responseContent: collectResponseContent(turnStartIdx, i - 1),
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
          responseContent: collectResponseContent(turnStartIdx, lastIdx),
        });
      }
    }
  }

  return result;
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
  pendingApproval?: ToolApprovalRequest;
  onApprovalRespond?: (requestId: string, approved: boolean, answer?: string) => void;
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
  pendingApproval,
  onApprovalRespond,
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
  const hasRunContent =
    !isEditorActive && !isIssueActive && !isSignalActive && !isNoteActive && !isNewRunActive && currentEvents.length > 0;

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

  // Group events for CLI-style display
  const allEventGroups = useMemo(
    () => groupEvents(currentEvents),
    [currentEvents],
  );

  // Filter out tool_calls groups when setting is off
  const eventGroups = useMemo(
    () => showToolCalls ? allEventGroups : allEventGroups.filter((g) => g.type !== "tool_calls"),
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

  // Fork handler: forks from the current run with a default prompt
  const handleFork = useCallback(
    (_responseContent: string) => {
      if (!activeRun || !onForkRun) return;
      onForkRun(activeRun.id, "Continue from where this session left off.");
    },
    [activeRun, onForkRun],
  );

  return (
    <div className=" text-sm h-full flex flex-col">
      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {isNewRunActive ? (
          <WorkspaceEmptyState workspace={currentWorkspace} />
        ) : isEditorActive ? (
          <EditorContent className="h-full" />
        ) : isIssueActive && activeIssue ? (
          <IssueTabContent issue={activeIssue} />
        ) : isSignalActive && activeSignal ? (
          <SignalTabContent signal={activeSignal} />
        ) : isNoteActive && activeNoteId ? (
          <NoteTabContent reviewId={activeNoteId} />
        ) : hasRunContent ? (
          <div className="h-full overflow-y-auto noscrollbar">
            <div className="min-h-75 max-w-210 mx-auto space-y-4 pt-12 pb-24 px-4">
              {eventGroups.map((group, index) => {
                // If this is a prompt_suggestion, render any session time bar
                // that was assigned to it BEFORE the suggestion (so it appears
                // after the model's last message, not after the suggestion chip).
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
                      // Standalone plan groups render PlanDisplay directly
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
                      <InfoGroup group={group} />
                    )}
                    {group.type !== "prompt_suggestion" && sessionBarForThis && (
                      <SessionTimeBar
                        info={sessionBarForThis}
                        onFork={index === lastSessionIndex && isRunCompleted && onForkRun ? handleFork : undefined}
                      />
                    )}
                  </Fragment>
                );
              })}
              {isRunning && <AsciiLoader variant={variant} thinkingText={latestThinking} />}
              {isRunning && pendingApproval && onApprovalRespond && (
                <ToolApprovalDialog
                  request={pendingApproval}
                  onRespond={onApprovalRespond}
                  variant={variant}
                />
              )}
              <div ref={eventsEndRef} />
            </div>
          </div>
        ) : (
          <WorkspaceEmptyState workspace={currentWorkspace} />
        )}
        {/* Top/bottom fade overlays — only shown on run content (chat), not on editor/issue/note tabs */}
        {hasRunContent && !isEditorActive && !isIssueActive && !isNoteActive && !isNewRunActive && (
            <div
              className="absolute top-0 left-0 right-0 h-24 bg-linear-to-b from-primary to-transparent dark:from-primary-950 dark:to-transparent pointer-events-none z-(--z-base)"
            />
                )}
            <div
              className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-primary to-transparent dark:from-primary-950 dark:to-transparent pointer-events-none"
            />
      </div>
    </div>
  );
}
