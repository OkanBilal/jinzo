import { useEffect, useMemo, useState } from "react";
import { Bot, Check, Close, Stop } from "@/components/ui/icons";
import { SquareSpinner } from "@/components/ui/square-spinner";
import { Caption } from "@/components/ui";
import { useGetToolCallsByRunQuery } from "@/lib/redux/api";
import { appEvents } from "@/lib/transport";
import { PanelItem, PANEL_ROW_X } from "./panel-item";
import {
  selectSessionSubagents,
  type SessionSubagent,
  type SubagentState,
} from "./select-session-subagents";

/** Rows shown before "Show N more" — the panel is a dropdown, not a page. */
const COLLAPSED_LIMIT = 6;

const STATE_TEXT: Record<SubagentState, string> = {
  running: "text-primary-600 dark:text-primary-300",
  done: "text-success dark:text-success",
  failed: "text-danger dark:text-danger",
  stopped: "text-warning dark:text-warning",
};

function StateIcon({ state }: { state: SubagentState }) {
  if (state === "running") return <SquareSpinner />;
  if (state === "done") return <Check className="size-3.5" />;
  if (state === "failed") return <Close className="size-3.5" />;
  return <Stop className="size-3.5" />;
}

/**
 * Subagents spawned during the run currently open in the workspace.
 *
 * Reads the run's tool calls rather than a dedicated table: a subagent has no
 * record of its own — it exists as lifecycle metadata patched onto the tool
 * call that spawned it (see `run-session.ts` `projectSubagent` / `projectTask`).
 */
export function SessionSubagents({ runId }: { runId: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: toolCalls, refetch } = useGetToolCallsByRunQuery(runId!, {
    skip: !runId,
    refetchOnMountOrArgChange: true,
  });

  // A live run patches subagent metadata onto tool calls continuously. Refetch
  // off the persisted-event signal instead of polling, coalesced so a burst of
  // events (a subagent's own tool calls) costs one round trip.
  useEffect(() => {
    if (!runId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = appEvents.runs.onEventPersisted((data) => {
      if (data.runId !== runId || timer) return;
      timer = setTimeout(() => {
        timer = null;
        refetch();
      }, 1500);
    });
    return () => {
      cleanup();
      if (timer) clearTimeout(timer);
    };
  }, [runId, refetch]);

  const subagents = useMemo(
    () => selectSessionSubagents(toolCalls ?? []),
    [toolCalls],
  );

  const visible = isExpanded ? subagents : subagents.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = subagents.length - visible.length;

  // A session with no subagents gets no section at all — not an empty-state
  // line. Most runs never spawn one, and a permanent "None yet." row would be
  // the panel's most-seen content while saying nothing.
  if (subagents.length === 0) return null;

  return (
    <div className=" border-t border-primary-200/40 pt-1 dark:border-primary-700/25">
      <div className={`flex items-center justify-between gap-2 py-1 ${PANEL_ROW_X}`}>
        <Caption className="text-xs text-primary-500">Subagents</Caption>
        <Caption className="text-xs tabular-nums text-primary-400">
          {subagents.length}
        </Caption>
      </div>

      {/* Capped so an expanded list can't push the panel past the viewport —
          the dropdown positions its top edge and cannot grow upward. */}
      <div className="max-h-56 overflow-y-auto noscrollbar">
        {visible.map((agent) => (
          <SubagentRow key={agent.id} agent={agent} />
        ))}
      </div>

      {(hiddenCount > 0 || isExpanded) && (
        <PanelItem
          icon={<span className="block size-4" />}
          label={
            <span className="text-xs text-primary-500">
              {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
            </span>
          }
          onClick={() => setIsExpanded((v) => !v)}
        />
      )}
    </div>
  );
}

function SubagentRow({ agent }: { agent: SessionSubagent }) {
  return (
    <PanelItem
      icon={<Bot className="size-4" />}
      title={agent.description}
      label={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0">{agent.agentType}</span>
          {agent.description && (
            <span className="truncate font-normal text-primary-500 dark:text-primary-400">
              {agent.description}
            </span>
          )}
        </span>
      }
      trailing={
        <span className={STATE_TEXT[agent.state]}>
          <StateIcon state={agent.state} />
        </span>
      }
    />
  );
}
