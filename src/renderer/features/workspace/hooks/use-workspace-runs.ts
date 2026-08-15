/**
 * The workspace's run list and everything read off it: which run is selected,
 * each run's transcript, and how both get loaded.
 *
 * Two subjects are delegated rather than inlined here, because neither is about
 * *holding* run state:
 *  - `use-run-operations.ts` — starting, continuing, forking, reviewing;
 *  - `use-run-sync.ts` — the push subscriptions, the polling fallback, and
 *    finalization for a live run.
 *
 * Both reach back through the same three seams (`registerNewRun`,
 * `loadRunDetails`, `onRunUpdated`), which is the whole contract between them
 * and this hook. Bookkeeping that isn't React state at all — the retained-run
 * LRU, incremental cursors, in-flight dedup — lives in `lib/run-cache.ts`.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { appApi } from "@/lib/transport";
import type { Run, RunEvent, RunArtifact, ToolCall } from "../types";
import type { RunTurn } from "@/lib/redux/api";
import { toast } from "@/components/ui";
import { useAppDispatch } from "@/lib/redux/hooks";
import { workspaceApi, useArchiveRunMutation } from "@/lib/redux/api";
import { mergeRunEvents } from "../utils/run-event-mappers";
import { createRunCache, pruneRunMap } from "../lib/run-cache";
import { useRunOperations } from "./use-run-operations";
import { useRunSync } from "./use-run-sync";
import { useStreamingEvents } from "./use-streaming-events";

/**
 * Hard cap on the per-run event list. A runaway agent can easily emit tens of
 * thousands of artifacts; we only need enough history to render, so we drop
 * the oldest entries once we exceed this threshold.
 */
const MAX_EVENTS_PER_RUN = 5000;

export function useWorkspaceRuns(
  workspaceId: string | undefined,
  providerId?: string,
) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runEvents, setRunEvents] = useState<Record<string, RunEvent[]>>({});
  const [runTurns, setRunTurns] = useState<Record<string, RunTurn[]>>({});
  const { streamingEvents, clearAllStreams } = useStreamingEvents(activeRunId);
  const dispatch = useAppDispatch();
  const [archiveRun] = useArchiveRunMutation();

  const eventsEndRef = useRef<HTMLDivElement>(null);
  // All run bookkeeping — LRU, incremental cursors, in-flight dedup, finalized
  // set — lives in this framework-free state machine (see lib/run-cache.ts).
  // A lazy `useState` rather than a ref: the box is never reassigned (only the
  // object inside mutates), and it has to be readable during render to be
  // handed to `useRunSync`.
  const [cache] = useState(createRunCache);

  // --- Internal helpers ---

  const clearState = useCallback(() => {
    setRuns([]);
    setActiveRunId(null);
    setRunEvents({});
    setRunTurns({});
    cache.clear();
  }, [cache]);

  /** Swap in a newer copy of one run, leaving the rest of the list untouched. */
  const onRunUpdated = useCallback((run: Run) => {
    setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
  }, []);

  /** Fetch a newly created run, add it to state, and return its ID */
  const registerNewRun = useCallback(async (runId: string): Promise<string | null> => {
    const runResult = await appApi.runs.getById(runId);
    if (runResult.success && runResult.data) {
      const newId = runResult.data.id;
      setRuns((prev) => [runResult.data, ...prev]);
      setActiveRunId(newId);
      dispatch(workspaceApi.util.invalidateTags(["Workspaces"]));
      const allowed = cache.touch(newId);
      setRunEvents((prev) =>
        pruneRunMap({ ...prev, [newId]: [] }, allowed),
      );
      setRunTurns((prev) => pruneRunMap(prev, allowed));
      return newId;
    }
    return null;
  }, [dispatch, cache]);

  // --- Data loading ---

  const loadRunDetailsOnce = useCallback(async (runId: string) => {
    try {
      // Full fetch the first time we load a run (or after it was evicted);
      // delta fetches afterwards. Artifacts are insert-only (cursor = max id);
      // tool calls update in place (cursor = max updatedAt). Turns are few, so
      // they stay a full fetch — always correct, no staleness.
      const { isIncremental, artifactSince, toolSinceMs } =
        cache.getDeltaCursors(runId);

      const [artifactsRes, toolCallsRes, turnsRes] = await Promise.all([
        appApi.runArtifacts.getByRun(runId, artifactSince),
        appApi.runs.getToolCalls(
          runId,
          toolSinceMs != null ? new Date(toolSinceMs) : undefined,
        ),
        appApi.runTurns.getByRun(runId),
      ]);

      const artifactDeltas: RunArtifact[] =
        artifactsRes.success && artifactsRes.data ? artifactsRes.data : [];
      const toolDeltas: ToolCall[] =
        toolCallsRes.success && toolCallsRes.data ? toolCallsRes.data : [];

      // Advance cursors from whatever we just fetched.
      if (artifactDeltas.length > 0) {
        const maxId = artifactDeltas.reduce((m, a) => (a.id > m ? a.id : m), 0);
        cache.advanceCursors(runId, { artifactMaxId: maxId });
      }
      if (toolDeltas.length > 0) {
        const maxUpdated = toolDeltas.reduce((m, tc) => {
          const t = new Date(tc.updatedAt).getTime();
          return t > m ? t : m;
        }, 0);
        cache.advanceCursors(runId, { toolMaxMs: maxUpdated });
      }
      cache.markLoaded(runId);

      // A finished CommitChanges tool means new committed changes — refresh diffs.
      if (
        toolDeltas.some(
          (tc) => tc.toolName.includes("CommitChanges") && tc.status === "done",
        )
      ) {
        dispatch(workspaceApi.util.invalidateTags(["WorkspaceDiffs"]));
      }

      const allowed = cache.touch(runId);

      setRunEvents((prev) => {
        const existing = isIncremental ? prev[runId] ?? [] : [];
        const merged = mergeRunEvents(existing, artifactDeltas, toolDeltas);
        // Cap event list per run — unbounded histories dominate renderer RAM.
        const capped =
          merged.length > MAX_EVENTS_PER_RUN
            ? merged.slice(merged.length - MAX_EVENTS_PER_RUN)
            : merged;
        // No change for this run (e.g. an idle poll): keep its reference so React
        // can bail; still prune any runs evicted from the LRU.
        if (capped === prev[runId]) return pruneRunMap(prev, allowed);
        return pruneRunMap({ ...prev, [runId]: capped }, allowed);
      });

      if (turnsRes.success && turnsRes.data) {
        setRunTurns((prev) =>
          pruneRunMap({ ...prev, [runId]: turnsRes.data }, allowed),
        );
      } else {
        setRunTurns((prev) => pruneRunMap(prev, allowed));
      }
    } catch (err) {
      console.error("Failed to load run details:", err);
    }
  }, [dispatch, cache]);

  /** Public entry point: runs at most one `loadRunDetailsOnce` per run at a time,
   *  with a single trailing refresh if another request arrived while it ran. This
   *  keeps the cursor advance and the committed event base consistent — two
   *  concurrent loads can no longer interleave into a partial history. */
  const loadRunDetails = useCallback(
    async (runId: string) => {
      // Admit one load per run; a request mid-load queues a single trailing reload.
      if (!cache.tryAcquireLoad(runId)) return;
      try {
        do {
          cache.clearPending(runId);
          await loadRunDetailsOnce(runId);
        } while (cache.hasPending(runId));
      } finally {
        cache.releaseLoad(runId);
      }
    },
    [loadRunDetailsOnce, cache],
  );

  const loadWorkspaceRuns = useCallback(
    async (wsId: string) => {
      try {
        const result = await appApi.runs.getByWorkspace(wsId, 50);
        if (result.success && result.data) {
          const filteredRuns = providerId
            ? result.data.filter((run: Run) => run.providerId === providerId)
            : result.data;

          setRuns(filteredRuns);
          if (filteredRuns.length > 0) {
            const firstRunId = filteredRuns[0].id;
            setActiveRunId(firstRunId);
            loadRunDetails(firstRunId);
          }
        }
      } catch (err) {
        console.error("Failed to load workspace runs:", err);
      }
    },
    [loadRunDetails, providerId],
  );

  useEffect(() => {
    void (async () => {
      clearState();
      if (workspaceId) {
        await loadWorkspaceRuns(workspaceId);
      }
    })();
  }, [workspaceId, loadWorkspaceRuns, clearState]);

  // --- Delegated subjects ---

  const { finalizeRun } = useRunSync({
    runs,
    activeRunId,
    cache,
    loadRunDetails,
    onRunUpdated,
    clearAllStreams,
  });

  const {
    isLoading,
    error,
    executeRun,
    continueRun,
    forkRun,
    executeReview,
    checkCanResume,
  } = useRunOperations({ registerNewRun, loadRunDetails, onRunUpdated });

  // --- Derived transcript ---

  const currentEvents = useMemo(() => {
    const dbEvents = activeRunId ? runEvents[activeRunId] || [] : [];
    if (streamingEvents.length === 0) return dbEvents;

    // Check if DB already has the streamed content (turn completed, artifact persisted)
    // If so, skip streaming events to avoid duplicates
    const dbArtifactContents = new Set(
      dbEvents
        .filter((e) => e.type === "artifact" && e.metadata?.kind === "report")
        .map((e) => e.content.trim()),
    );

    const activeStreams = streamingEvents.filter(
      (se) => !dbArtifactContents.has(se.content.trim()),
    );

    if (activeStreams.length === 0) return dbEvents;

    const streamRunEvents: RunEvent[] = activeStreams.map((se) => {
      // Live progress for codex commands (e.g. npm install) routes to the
      // AsciiLoader status line, not into the main timeline as an
      // agent-message bubble.
      const kind =
        se.kind === "image_generation" ? "image_generation"
          : se.streamId.startsWith("cursor-think-") ? "thinking"
          : se.streamId.startsWith("codex-cmd-") ? "thinking"
          : se.streamId.startsWith("claude-think-") ? "thinking"
          : "report";
      return {
        id: se.id,
        type: "artifact" as const,
        content: se.content,
        timestamp: new Date(se.timestamp),
        metadata: {
          ...se.metadata,
          kind,
          streaming: true,
          streamId: se.streamId,
        },
      };
    });

    return [...dbEvents, ...streamRunEvents];
  }, [activeRunId, runEvents, streamingEvents]);

  // Auto-scroll to bottom
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentEvents]);

  // --- Tab operations ---

  const closeTab = useCallback(
    async (runId: string) => {
      try {
        await archiveRun(runId).unwrap();
      } catch (error) {
        console.error("[useWorkspaceRuns] Failed to archive run:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to archive run",
        );
        return;
      }

      setRuns((prev) => {
        const newRuns = prev.filter((r) => r.id !== runId);
        if (activeRunId === runId && newRuns.length > 0) {
          setActiveRunId(newRuns[0].id);
          loadRunDetails(newRuns[0].id);
        } else if (newRuns.length === 0) {
          setActiveRunId(null);
        }
        return newRuns;
      });
      // Drop from the LRU + incremental bookkeeping so reopening re-fetches fresh.
      cache.forget(runId);
      setRunEvents((prev) => {
        if (!(runId in prev)) return prev;
        const next = { ...prev };
        delete next[runId];
        return next;
      });
      setRunTurns((prev) => {
        if (!(runId in prev)) return prev;
        const next = { ...prev };
        delete next[runId];
        return next;
      });
    },
    [activeRunId, archiveRun, loadRunDetails, cache],
  );

  const selectTab = useCallback(
    (runId: string) => {
      const wasPending = runs.some(
        (run) =>
          run.id === runId &&
          (run.status === "running" || run.status === "queued"),
      );

      setActiveRunId(runId);

      // Always reconcile on tab focus. Besides refreshing the transcript,
      // this is the immediate fallback for a dropped/backgrounded status push.
      void loadRunDetails(runId);
      void (async () => {
        const result = await appApi.runs.getById(runId);
        if (!result.success || !result.data) return;

        onRunUpdated(result.data);
        if (wasPending) await finalizeRun(result.data);
      })();
    },
    [runs, loadRunDetails, finalizeRun, onRunUpdated],
  );

  const activeRun = runs.find((r) => r.id === activeRunId);
  const currentTurns = useMemo(
    () => (activeRunId ? runTurns[activeRunId] || [] : []),
    [activeRunId, runTurns],
  );

  return {
    runs,
    setRuns,
    activeRunId,
    activeRun,
    runEvents,
    currentEvents,
    currentTurns,
    isLoading,
    error,
    eventsEndRef,
    setActiveRunId,
    executeRun,
    continueRun,
    forkRun,
    executeReview,
    checkCanResume,
    closeTab,
    selectTab,
  };
}
