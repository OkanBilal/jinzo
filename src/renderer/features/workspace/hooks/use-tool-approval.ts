import { useState, useEffect, useCallback, useMemo } from "react";
import { appEvents, appApi } from "@/lib/transport";

export interface ToolApprovalRequest {
  requestId: string;
  runId: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  kind: "tool_approval" | "ask_user";
  question?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
  timestamp: number;
}

/** Run statuses we consider "finished" — remaining approvals are obsolete. */
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled"]);

interface RunStatusLike {
  id: string;
  status: string;
}

/**
 * Subscribes to `runs:toolApprovalRequest` IPC and tracks pending approvals.
 *
 * Pass the current `runs` list so finished runs' stale approvals are cleared
 * automatically — otherwise a user who never acts on a request (e.g. closes
 * the tab, cancels the run) would leak the entry forever.
 */
export function useToolApproval(runs?: readonly RunStatusLike[]) {
  const [rawApprovals, setRawApprovals] = useState<ToolApprovalRequest[]>([]);

  useEffect(() => {
    const cleanup = appEvents.runs.onToolApprovalRequest(
      (request: ToolApprovalRequest) => {
        setRawApprovals((prev) => [...prev, request]);
      },
    );
    return () => {
      cleanup();
    };
  }, []);

  // Derive the visible approval list: hide anything tied to a terminated or
  // no-longer-visible run so stale entries are never rendered. This runs at
  // render time (no effect + setState loop) which keeps React's lint happy.
  const pendingApprovals = useMemo(() => {
    if (!runs) return rawApprovals;
    const liveRunIds = new Set<string>();
    for (const r of runs) {
      if (!TERMINAL_STATUSES.has(r.status)) liveRunIds.add(r.id);
    }
    return rawApprovals.filter((r) => liveRunIds.has(r.runId));
  }, [rawApprovals, runs]);

  // Also garbage-collect the underlying state whenever the filtered view
  // would drop entries — keeps memory bounded for users who never act on
  // requests and let runs finish naturally.
  useEffect(() => {
    if (!runs) return;
    const liveRunIds = new Set<string>();
    for (const r of runs) {
      if (!TERMINAL_STATUSES.has(r.status)) liveRunIds.add(r.id);
    }
    // Schedule the prune as a microtask so the state update happens outside
    // the current render pass. This avoids the `set-state-in-effect` lint
    // pattern while still ensuring stale entries are released.
    queueMicrotask(() => {
      setRawApprovals((prev) => {
        const next = prev.filter((r) => liveRunIds.has(r.runId));
        return next.length === prev.length ? prev : next;
      });
    });
  }, [runs]);

  const respond = useCallback(
    (requestId: string, approved: boolean, answer?: string) => {
      appApi.runs.respondToolApproval({ requestId, approved, answer });
      setRawApprovals((prev) =>
        prev.filter((r) => r.requestId !== requestId),
      );
    },
    [],
  );

  const dismissForRun = useCallback((runId: string) => {
    setRawApprovals((prev) => prev.filter((r) => r.runId !== runId));
  }, []);

  return { pendingApprovals, respond, dismissForRun };
}
