import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Run, RunEvent } from "../types";
import type { RunTurn } from "@/lib/redux/api";
import { toast } from "@/components/ui";
import { useAppDispatch } from "@/lib/redux/hooks";
import { runsApi, workspacesApi, reviewsApi, reviewFindingsApi, workspaceDiffsApi } from "@/lib/redux/api";
import { mapArtifactToEvent, mapToolCallToEvent } from "../utils/run-event-mappers";
import { useStreamingEvents } from "./use-streaming-events";

type Attachments = Array<{ name: string; type: string; data: string; mimeType: string }>;
type ContextIssue = { provider: string; number?: number | null; title: string; body?: string | null };
type ContextSignal = { source: string; level: string; category: string; title: string; body?: string | null; stackTrace?: string | null; eventCount?: number };
type ContextFile = { fullPath: string; displayName?: string };

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
  const lastCommitCountRef = useRef<number>(0);

  // --- Internal helpers ---

  const clearState = useCallback(() => {
    setRuns([]);
    setActiveRunId(null);
    setRunEvents({});
    setRunTurns({});
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
      const accountRes = await window.api.account.get();
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
    const runResult = await window.api.runs.getById(runId);
    if (runResult.success && runResult.data) {
      setRuns((prev) => [runResult.data, ...prev]);
      setActiveRunId(runResult.data.id);
      dispatch(workspacesApi.util.invalidateTags(["Workspaces"]));
      lastCommitCountRef.current = 0;
      setRunEvents((prev) => ({ ...prev, [runResult.data.id]: [] }));
      return runResult.data.id;
    }
    return null;
  }, [dispatch]);

  // --- Data loading ---

  const loadRunDetails = useCallback(async (runId: string) => {
    try {
      const [artifactsRes, toolCallsRes, turnsRes] = await Promise.all([
        window.api.runArtifacts.getByRun(runId),
        window.api.runs.getToolCalls(runId),
        window.api.runTurns.getByRun(runId),
      ]);

      const events: RunEvent[] = [];

      if (artifactsRes.success && artifactsRes.data) {
        events.push(...artifactsRes.data.map(mapArtifactToEvent));
      }

      if (toolCallsRes.success && toolCallsRes.data) {
        for (const tc of toolCallsRes.data) {
          const event = mapToolCallToEvent(tc);
          if (event) events.push(event);
        }

        // Invalidate diffs cache when a new CommitChanges tool call appears mid-run
        const commitCount = toolCallsRes.data.filter(
          (tc: { toolName: string }) => tc.toolName.includes("CommitChanges"),
        ).length;
        if (commitCount > lastCommitCountRef.current) {
          lastCommitCountRef.current = commitCount;
          dispatch(workspaceDiffsApi.util.invalidateTags(["WorkspaceDiffs"]));
        }
      }

      events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setRunEvents((prev) => ({ ...prev, [runId]: events }));

      if (turnsRes.success && turnsRes.data) {
        setRunTurns((prev) => ({ ...prev, [runId]: turnsRes.data }));
      }
    } catch (err) {
      console.error("Failed to load run details:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWorkspaceRuns = useCallback(
    async (wsId: string) => {
      try {
        const result = await window.api.runs.getByWorkspace(wsId, 50);
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
    clearState();
    if (workspaceId) {
      loadWorkspaceRuns(workspaceId);
    }
  }, [workspaceId, loadWorkspaceRuns, clearState]);

  // Poll for updates when active run is running
  useEffect(() => {
    const activeRun = runs.find((r) => r.id === activeRunId);
    if (!activeRun || activeRun.status !== "running") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      clearAllStreams();
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        if (activeRunId) {
          loadRunDetails(activeRunId);

          const result = await window.api.runs.getById(activeRunId);
          if (result.success && result.data) {
            setRuns((prev) =>
              prev.map((r) => (r.id === activeRunId ? result.data : r)),
            );

            if (result.data.status !== "running") {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }

              if (result.data.status === "failed") {
                const lastError = result.data.lastError || "Run failed";

                // Detect auth error from lastError or run artifacts
                let isAuthError = /not logged in|not authenticated|gh auth login/i.test(lastError);
                if (!isAuthError && /exited with code/i.test(lastError)) {
                  const artRes = await window.api.runArtifacts.getByRun(activeRunId);
                  if (artRes.success && artRes.data) {
                    isAuthError = artRes.data.some(
                      (a: { content: any; }) => /not logged in|not authenticated|gh auth login/i.test(a.content ?? ""),
                    );
                  }
                }
                // TODO: IMPROVE: This is a very naive way to detect auth errors. We should standardize error reporting from providers to make this more robust.
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
              } else if (result.data.status === "canceled") {
                toast("Run canceled");
              }

              dispatch(runsApi.util.invalidateTags(["Runs", "WorkspaceDiffs"]));
              dispatch(workspacesApi.util.invalidateTags(["Workspaces"]));
              dispatch(reviewsApi.util.invalidateTags(["Reviews"]));
              dispatch(reviewFindingsApi.util.invalidateTags(["ReviewFindings"]));
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId, runs, loadRunDetails]);

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

    const streamRunEvents: RunEvent[] = activeStreams.map((se) => ({
      id: se.id,
      type: "artifact" as const,
      content: se.content,
      timestamp: new Date(se.timestamp),
      metadata: { kind: "report", streaming: true, streamId: se.streamId },
    }));

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
    ) => {
      if (!goal.trim() || !selectedWorkspace || !selectedProvider) {
        toast.error("Please fill in all required fields");
        return null;
      }

      return runOperation(async (accountId) => {
        const result = await window.api.runs.execute({
          accountId,
          workspaceId: selectedWorkspace,
          providerId: selectedProvider,
          goal: goal.trim(),
          model: model || undefined,
          initialContext: [],
          attachments,
          contextIssues: contextIssues?.map(i => ({ provider: i.provider, number: i.number, title: i.title, body: i.body })),
          contextFiles: contextFiles?.map(f => ({ path: f.fullPath })),
          contextSignals: contextSignals?.map(s => ({ source: s.source, level: s.level, category: s.category, title: s.title, body: s.body, stackTrace: s.stackTrace, eventCount: s.eventCount })),
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
  ) => {
    if (!message.trim()) {
      setError("Please enter a message");
      return false;
    }

    return runOperation(async (accountId) => {
      const result = await window.api.runs.continue({
        runId,
        accountId,
        message: message.trim(),
        model: model || undefined,
        attachments,
        contextIssues: contextIssues?.map(i => ({ provider: i.provider, number: i.number, title: i.title, body: i.body })),
        contextFiles: contextFiles?.map(f => ({ path: f.fullPath })),
        contextSignals: contextSignals?.map(s => ({ source: s.source, level: s.level, category: s.category, title: s.title, body: s.body, stackTrace: s.stackTrace, eventCount: s.eventCount })),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to continue run");
      }

      const runResult = await window.api.runs.getById(runId);
      if (runResult.success && runResult.data) {
        setRuns((prev) =>
          prev.map((r) => (r.id === runId ? runResult.data : r)),
        );
      }

      dispatch(workspacesApi.util.invalidateTags(["Workspaces"]));
      return true;
    }, false, "Failed to continue run");
  }, [runOperation, dispatch]);

  const forkRun = useCallback(
    async (sourceRunId: string, message: string): Promise<string | null> => {
      if (!message.trim()) {
        setError("Please enter a message");
        return null;
      }

      return runOperation(async (accountId) => {
        const result = await window.api.runs.fork({
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

  const checkCanResume = useCallback(
    async (runId: string): Promise<boolean> => {
      try {
        const result = await window.api.runs.canResume(runId);
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
        await window.api.runs.archive(runId);
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
    },
    [activeRunId, loadRunDetails],
  );

  const selectTab = useCallback(
    (runId: string) => {
      setActiveRunId(runId);
      if (!runEvents[runId]) {
        loadRunDetails(runId);
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
    checkCanResume,
    closeTab,
    selectTab,
  };
}
