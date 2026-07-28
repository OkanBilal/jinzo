import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { appEvents, appApi } from "@/lib/transport";
import type { Run, RunEvent, RunArtifact, ToolCall } from "../types";
import type { RunTurn } from "@/lib/redux/api";
import { toast } from "@/components/ui";
import { useAppDispatch } from "@/lib/redux/hooks";
import { runsApi, workspaceApi } from "@/lib/redux/api";
import { mergeRunEvents } from "../utils/run-event-mappers";
import { createRunCache, pruneRunMap } from "../lib/run-cache";
import { useStreamingEvents } from "./use-streaming-events";

type Attachments = Array<{
  name: string;
  type: string;
  data?: string;
  sourcePath?: string;
  mimeType: string;
}>;
type ContextIssue = { provider: string; number?: number | null; title: string; body?: string | null };
type ContextSignal = { source: string; level: string; category: string; title: string; body?: string | null; stackTrace?: string | null; eventCount?: number };
type ContextFile = { fullPath: string; displayName?: string };
type ContextSkill = {
  name: string;
  path?: string;
  description?: string;
  displayName?: string;
  shortDescription?: string;
  iconSmall?: string;
  iconLarge?: string;
  brandColor?: string;
  scope?: string;
};
type BrowserContextSelection = {
  id: string;
  url: string;
  title: string;
  selector: string;
  tagName: string;
  text: string;
  styles: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  pageRect: { x: number; y: number; width: number; height: number };
  componentName?: string;
  sourceFile?: string;
  timestamp: string;
  /** Absolute path to the element screenshot on disk. */
  screenshotPath?: string;
  /** Absolute path to the surrounding-context screenshot on disk. */
  surroundingScreenshotPath?: string;
  screenshotMimeType: string;
};

type InitialContextItem = {
  kind: "file" | "diff" | "selection" | "note";
  ref?: string;
  content?: string;
  metadata?: Record<string, unknown>;
};

/** Build attachments + initialContext from browser selections. Screenshots go as image attachments; structural data goes as "selection" context items. */
function browserSelectionsToPayload(
  selections: BrowserContextSelection[] | undefined,
): { attachments: Attachments; initialContext: InitialContextItem[] } {
  const attachments: Attachments = [];
  const initialContext: InitialContextItem[] = [];
  if (!selections?.length) return { attachments, initialContext };

  for (const sel of selections) {
    const host = (() => {
      try { return new URL(sel.url).hostname; } catch { return "page"; }
    })();
    const slug = (sel.componentName || sel.tagName || "element").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();

    if (sel.screenshotPath) {
      attachments.push({
        name: `browser-${host}-${slug}-${sel.id.slice(0, 6)}.png`,
        type: "image",
        sourcePath: sel.screenshotPath,
        mimeType: sel.screenshotMimeType || "image/png",
      });
    }
    if (sel.surroundingScreenshotPath) {
      attachments.push({
        name: `browser-${host}-${slug}-${sel.id.slice(0, 6)}-context.png`,
        type: "image",
        sourcePath: sel.surroundingScreenshotPath,
        mimeType: sel.screenshotMimeType || "image/png",
      });
    }

    const content = [
      `Browser selection: ${sel.componentName ? `<${sel.componentName}>` : sel.tagName}`,
      `URL: ${sel.url}`,
      sel.title ? `Page title: ${sel.title}` : null,
      `Selector: ${sel.selector}`,
      sel.sourceFile ? `Source file: ${sel.sourceFile}` : null,
      sel.text ? `Visible text: ${sel.text}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    initialContext.push({
      kind: "selection",
      ref: sel.url,
      content,
      metadata: {
        source: "browser",
        id: sel.id,
        url: sel.url,
        title: sel.title,
        selector: sel.selector,
        tagName: sel.tagName,
        styles: sel.styles,
        rect: sel.rect,
        pageRect: sel.pageRect,
        componentName: sel.componentName,
        sourceFile: sel.sourceFile,
        timestamp: sel.timestamp,
      },
    });
  }
  return { attachments, initialContext };
}

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { streamingEvents, clearAllStreams } = useStreamingEvents(activeRunId);
  const dispatch = useAppDispatch();

  const eventsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // All run bookkeeping — LRU, incremental cursors, in-flight dedup, finalized
  // set — lives in this framework-free state machine (see lib/run-cache.ts).
  const cacheRef = useRef(createRunCache());

  // --- Internal helpers ---

  const clearState = useCallback(() => {
    setRuns([]);
    setActiveRunId(null);
    setRunEvents({});
    setRunTurns({});
    cacheRef.current.clear();
  }, []);

  /** Wraps async run operations with loading state, account fetch, and error handling */
  const runOperation = useCallback(async <T>(
    fn: (accountId: string) => Promise<T>,
    fallback: T,
    errorLabel: string,
  ): Promise<T> => {
    setIsLoading(true);
    setError(null);
    try {
      const accountRes = await appApi.account.get();
      if (!accountRes.success || !accountRes.data) {
        throw new Error("No account found");
      }
      return await fn(accountRes.data.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : errorLabel;
      setError(message);
      toast.error(message);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Fetch a newly created run, add it to state, and return its ID */
  const registerNewRun = useCallback(async (runId: string): Promise<string | null> => {
    const runResult = await appApi.runs.getById(runId);
    if (runResult.success && runResult.data) {
      const newId = runResult.data.id;
      setRuns((prev) => [runResult.data, ...prev]);
      setActiveRunId(newId);
      dispatch(workspaceApi.util.invalidateTags(["Workspaces"]));
      const allowed = cacheRef.current.touch(newId);
      setRunEvents((prev) =>
        pruneRunMap({ ...prev, [newId]: [] }, allowed),
      );
      setRunTurns((prev) => pruneRunMap(prev, allowed));
      return newId;
    }
    return null;
  }, [dispatch]);

  // --- Data loading ---

  const loadRunDetailsOnce = useCallback(async (runId: string) => {
    try {
      // Full fetch the first time we load a run (or after it was evicted);
      // delta fetches afterwards. Artifacts are insert-only (cursor = max id);
      // tool calls update in place (cursor = max updatedAt). Turns are few, so
      // they stay a full fetch — always correct, no staleness.
      const { isIncremental, artifactSince, toolSinceMs } =
        cacheRef.current.getDeltaCursors(runId);

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
        cacheRef.current.advanceCursors(runId, { artifactMaxId: maxId });
      }
      if (toolDeltas.length > 0) {
        const maxUpdated = toolDeltas.reduce((m, tc) => {
          const t = new Date(tc.updatedAt).getTime();
          return t > m ? t : m;
        }, 0);
        cacheRef.current.advanceCursors(runId, { toolMaxMs: maxUpdated });
      }
      cacheRef.current.markLoaded(runId);

      // A finished CommitChanges tool means new committed changes — refresh diffs.
      if (
        toolDeltas.some(
          (tc) => tc.toolName.includes("CommitChanges") && tc.status === "done",
        )
      ) {
        dispatch(workspaceApi.util.invalidateTags(["WorkspaceDiffs"]));
      }

      const allowed = cacheRef.current.touch(runId);

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
  }, [dispatch]);

  /** Public entry point: runs at most one `loadRunDetailsOnce` per run at a time,
   *  with a single trailing refresh if another request arrived while it ran. This
   *  keeps the cursor advance and the committed event base consistent — two
   *  concurrent loads can no longer interleave into a partial history. */
  const loadRunDetails = useCallback(
    async (runId: string) => {
      // Admit one load per run; a request mid-load queues a single trailing reload.
      if (!cacheRef.current.tryAcquireLoad(runId)) return;
      try {
        do {
          cacheRef.current.clearPending(runId);
          await loadRunDetailsOnce(runId);
        } while (cacheRef.current.hasPending(runId));
      } finally {
        cacheRef.current.releaseLoad(runId);
      }
    },
    [loadRunDetailsOnce],
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

  // --- Effects ---

  useEffect(() => {
    void (async () => {
      clearState();
      if (workspaceId) {
        await loadWorkspaceRuns(workspaceId);
      }
    })();
  }, [workspaceId, loadWorkspaceRuns, clearState]);

  // Derive the active run's status so the effects below only rebind on actual
  // status flips, not on every `runs` refetch.
  const activeRunStatus = useMemo(
    () => runs.find((r) => r.id === activeRunId)?.status,
    [runs, activeRunId],
  );

  const finalizeRun = useCallback(async (run: Run) => {
    if (run.status === "running" || run.status === "queued") return;
    if (cacheRef.current.isFinalized(run.id)) return;
    cacheRef.current.markFinalized(run.id);

    if (run.status === "failed") {
      const lastError = run.lastError || "Run failed";
      let isAuthError = /not logged in|not authenticated|gh auth login/i.test(lastError);
      if (!isAuthError && /exited with code/i.test(lastError)) {
        const artRes = await appApi.runArtifacts.getByRun(run.id);
        if (artRes.success && artRes.data) {
          isAuthError = artRes.data.some(
            (a: { content: any }) =>
              /not logged in|not authenticated|gh auth login/i.test(a.content ?? ""),
          );
        }
      }
      // Regex-based detection is fragile — providers should return a
      // structured `lastErrorCode: "auth"` so this branch can go away.
      if (isAuthError) {
        const isCopilot = /gh auth/i.test(lastError);
        toast.error(
          isCopilot
            ? "GitHub CLI not authenticated — run `gh auth login` in your terminal"
            : "Not logged in — run `claude login` in your terminal",
          { duration: 8000 },
        );
      } else {
        toast.error(lastError, { duration: 5000 });
      }
    } else if (run.status === "canceled") {
      toast.error("Run canceled");
    }

    dispatch(runsApi.util.invalidateTags(["Runs", "WorkspaceDiffs"]));
    dispatch(workspaceApi.util.invalidateTags(["Workspaces"]));
    dispatch(workspaceApi.util.invalidateTags(["Reviews"]));
    dispatch(workspaceApi.util.invalidateTags(["ReviewFindings"]));
  }, [dispatch]);

  // Push subscription: main broadcasts after each persisted event and on
  // terminal transitions. Debounce refetches to coalesce bursts.
  useEffect(() => {
    if (!activeRunId || activeRunStatus !== "running") return;

    let refetchTimer: number | null = null;
    const scheduleRefetch = () => {
      if (refetchTimer !== null) return;
      refetchTimer = window.setTimeout(() => {
        refetchTimer = null;
        loadRunDetails(activeRunId);
      }, 250);
    };

    const offEvent = appEvents.runs.onEventPersisted(({ runId }) => {
      if (runId === activeRunId) scheduleRefetch();
    });

    const offStatus = appEvents.runs.onStatusChanged(async ({ runId }) => {
      if (runId !== activeRunId) return;
      const result = await appApi.runs.getById(activeRunId);
      if (result.success && result.data) {
        setRuns((prev) => prev.map((r) => (r.id === activeRunId ? result.data : r)));
        await finalizeRun(result.data);
      }
      void loadRunDetails(activeRunId);
    });

    // Live workspace diff: invalidate cached diff queries on each
    // incremental recomputation so the UI re-renders with fresh changes.
    const offDiff = appEvents.runs.onDiffUpdated(({ runId, workspaceId }) => {
      if (runId !== activeRunId) return;
      dispatch(
        workspaceApi.util.invalidateTags([
          { type: "WorkspaceDiffs", id: workspaceId },
        ]),
      );
    });

    return () => {
      offEvent();
      offStatus();
      offDiff();
      if (refetchTimer !== null) window.clearTimeout(refetchTimer);
    };
  }, [activeRunId, activeRunStatus, loadRunDetails, finalizeRun, dispatch]);

  // Polling fallback for dropped pushes, stalled adapters, or backgrounded
  // renderers. 10s keeps IO low since push handles the common case.
  useEffect(() => {
    if (activeRunStatus !== "running") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      clearAllStreams();
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        if (!activeRunId) return;
        loadRunDetails(activeRunId);

        const result = await appApi.runs.getById(activeRunId);
        if (!result.success || !result.data) return;

        setRuns((prev) =>
          prev.map((r) => (r.id === activeRunId ? result.data : r)),
        );

        if (result.data.status !== "running") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          await finalizeRun(result.data);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId, activeRunStatus, loadRunDetails, finalizeRun]);

  // Auto-scroll to bottom
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
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentEvents]);

  // --- Run operations ---

  const executeRun = useCallback(
    async (
      goal: string,
      selectedWorkspace: string,
      selectedProvider: string,
      model?: string,
      attachments?: Attachments,
      contextIssues?: ContextIssue[],
      contextFiles?: ContextFile[],
      contextSignals?: ContextSignal[],
      contextBrowserSelections?: BrowserContextSelection[],
      contextSkills?: ContextSkill[],
    ) => {
      if (!goal.trim() || !selectedWorkspace || !selectedProvider) {
        toast.error("Please fill in all required fields");
        return null;
      }

      const browserPayload = browserSelectionsToPayload(contextBrowserSelections);
      const mergedAttachments =
        browserPayload.attachments.length > 0 || attachments?.length
          ? [...(attachments ?? []), ...browserPayload.attachments]
          : undefined;

      return runOperation(async (accountId) => {
        const result = await appApi.runs.execute({
          accountId,
          workspaceId: selectedWorkspace,
          providerId: selectedProvider,
          goal: goal.trim(),
          model: model || undefined,
          initialContext: browserPayload.initialContext,
          attachments: mergedAttachments,
          contextIssues: contextIssues?.map(i => ({ provider: i.provider, number: i.number, title: i.title, body: i.body })),
          contextFiles: contextFiles?.map(f => ({ path: f.fullPath })),
          contextSignals: contextSignals?.map(s => ({ source: s.source, level: s.level, category: s.category, title: s.title, body: s.body, stackTrace: s.stackTrace, eventCount: s.eventCount })),
          contextSkills: contextSkills?.map(s => ({
            name: s.name,
            path: s.path,
            displayName: s.displayName,
            description: s.description,
            shortDescription: s.shortDescription,
            iconSmall: s.iconSmall,
            iconLarge: s.iconLarge,
            brandColor: s.brandColor,
            scope: s.scope,
          })),
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to start run");
        }

        return registerNewRun(result.data.runId);
      }, null, "Failed to execute run");
    },
    [runOperation, registerNewRun],
  );

  const continueRun = useCallback(async (
    runId: string,
    message: string,
    attachments?: Attachments,
    contextIssues?: ContextIssue[],
    contextFiles?: ContextFile[],
    contextSignals?: ContextSignal[],
    model?: string,
    contextBrowserSelections?: BrowserContextSelection[],
    contextSkills?: ContextSkill[],
  ) => {
    if (!message.trim()) {
      setError("Please enter a message");
      return false;
    }

    const browserPayload = browserSelectionsToPayload(contextBrowserSelections);
    const mergedAttachments =
      browserPayload.attachments.length > 0 || attachments?.length
        ? [...(attachments ?? []), ...browserPayload.attachments]
        : undefined;

    return runOperation(async (accountId) => {
      const result = await appApi.runs.continue({
        runId,
        accountId,
        message: message.trim(),
        model: model || undefined,
        attachments: mergedAttachments,
        additionalContext: browserPayload.initialContext,
        contextIssues: contextIssues?.map(i => ({ provider: i.provider, number: i.number, title: i.title, body: i.body })),
        contextFiles: contextFiles?.map(f => ({ path: f.fullPath })),
        contextSignals: contextSignals?.map(s => ({ source: s.source, level: s.level, category: s.category, title: s.title, body: s.body, stackTrace: s.stackTrace, eventCount: s.eventCount })),
        contextSkills: contextSkills?.map(s => ({
          name: s.name,
          path: s.path,
          displayName: s.displayName,
          description: s.description,
          shortDescription: s.shortDescription,
          iconSmall: s.iconSmall,
          iconLarge: s.iconLarge,
          brandColor: s.brandColor,
          scope: s.scope,
        })),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to continue run");
      }

      const runResult = await appApi.runs.getById(runId);
      if (runResult.success && runResult.data) {
        setRuns((prev) =>
          prev.map((r) => (r.id === runId ? runResult.data : r)),
        );
      }

      void loadRunDetails(runId);

      dispatch(workspaceApi.util.invalidateTags(["Workspaces"]));
      return true;
    }, false, "Failed to continue run");
  }, [runOperation, dispatch, loadRunDetails]);

  const forkRun = useCallback(
    async (sourceRunId: string, message: string): Promise<string | null> => {
      if (!message.trim()) {
        setError("Please enter a message");
        return null;
      }

      return runOperation(async (accountId) => {
        const result = await appApi.runs.fork({
          sourceRunId,
          accountId,
          message: message.trim(),
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to fork run");
        }

        return registerNewRun(result.data.runId);
      }, null, "Failed to fork run");
    },
    [runOperation, registerNewRun],
  );

  const executeReview = useCallback(
    async (
      selectedWorkspace: string,
      selectedProvider: string,
      target: {
        type: "uncommittedChanges" | "baseBranch" | "commit" | "custom";
        branch?: string;
        sha?: string;
        title?: string;
        instructions?: string;
      },
      model?: string,
    ): Promise<string | null> => {
      if (!selectedWorkspace || !selectedProvider) {
        toast.error("Please select a workspace and provider");
        return null;
      }

      return runOperation(async (accountId) => {
        const result = await appApi.runs.executeReview({
          accountId,
          workspaceId: selectedWorkspace,
          providerId: selectedProvider,
          target,
          model: model || undefined,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to start review");
        }

        return registerNewRun(result.data.runId);
      }, null, "Failed to execute review");
    },
    [runOperation, registerNewRun],
  );

  const checkCanResume = useCallback(
    async (runId: string): Promise<boolean> => {
      try {
        const result = await appApi.runs.canResume(runId);
        return result.success && result.data === true;
      } catch {
        return false;
      }
    },
    [],
  );

  const closeTab = useCallback(
    async (runId: string) => {
      try {
        await appApi.runs.archive(runId);
      } catch (error) {
        console.error("[useWorkspaceRuns] Failed to archive run:", error);
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
      cacheRef.current.forget(runId);
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
    [activeRunId, loadRunDetails],
  );

  const selectTab = useCallback(
    (runId: string) => {
      setActiveRunId(runId);
      if (!runEvents[runId]) {
        loadRunDetails(runId);
      } else {
        // Already in memory — bump its LRU position and re-prune in case
        // another tab push crowded the whitelist since.
        const allowed = cacheRef.current.touch(runId);
        setRunEvents((prev) => pruneRunMap(prev, allowed));
        setRunTurns((prev) => pruneRunMap(prev, allowed));
      }
    },
    [runEvents, loadRunDetails],
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
