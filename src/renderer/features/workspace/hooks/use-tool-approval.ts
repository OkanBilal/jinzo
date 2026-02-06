import { useState, useEffect, useCallback } from "react";

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

export function useToolApproval() {
  const [pendingApprovals, setPendingApprovals] = useState<
    ToolApprovalRequest[]
  >([]);

  useEffect(() => {
    const cleanup = window.api.runs.onToolApprovalRequest(
      (request: ToolApprovalRequest) => {
        setPendingApprovals((prev) => [...prev, request]);
      },
    );
    return () => {
      cleanup();
    };
  }, []);

  const respond = useCallback(
    (requestId: string, approved: boolean, answer?: string) => {
      window.api.runs.respondToolApproval({ requestId, approved, answer });
      setPendingApprovals((prev) =>
        prev.filter((r) => r.requestId !== requestId),
      );
    },
    [],
  );

  const dismissForRun = useCallback((runId: string) => {
    setPendingApprovals((prev) => prev.filter((r) => r.runId !== runId));
  }, []);

  return { pendingApprovals, respond, dismissForRun };
}
