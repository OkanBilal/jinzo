import { BrowserWindow } from "electron";
import type { ToolApprovalRequest, ToolApprovalResponse } from "./runs.dto";

/**
 * Singleton broker that manages pending tool-approval requests.
 *
 * Flow:
 *  1. The Claude adapter's PreToolUse hook calls `requestToolApproval(req)`.
 *  2. The broker creates a Promise, stores its resolve fn, and broadcasts
 *     the request to every open BrowserWindow via IPC push.
 *  3. The renderer displays a dialog; the user clicks Allow/Deny (or answers).
 *  4. The renderer calls `window.api.runs.respondToolApproval(response)`.
 *  5. The main-process IPC handler calls `handleToolApprovalResponse(resp)`.
 *  6. The stored resolve fn fires → the awaiting hook gets the result.
 */

const PUSH_CHANNEL = "runs:toolApprovalRequest";
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface PendingRequest {
  runId: string;
  resolve: (response: ToolApprovalResponse) => void;
  timer: NodeJS.Timeout;
}

const pending = new Map<string, PendingRequest>();

/**
 * Broadcast a tool-approval request to all renderer windows and
 * return a Promise that resolves when the user responds (or times out).
 */
export function requestToolApproval(
  req: ToolApprovalRequest,
): Promise<ToolApprovalResponse> {
  return new Promise<ToolApprovalResponse>((resolve) => {
    // Auto-deny after timeout
    const timer = setTimeout(() => {
      pending.delete(req.requestId);
      resolve({ requestId: req.requestId, approved: false });
    }, REQUEST_TIMEOUT_MS);

    pending.set(req.requestId, {
      runId: req.runId,
      resolve,
      timer,
    });

    // Broadcast to all open windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(PUSH_CHANNEL, req);
      }
    }
  });
}

/**
 * Resolve a pending approval request with the user's response.
 * Called from the IPC handler when the renderer sends back a decision.
 */
export function handleToolApprovalResponse(resp: ToolApprovalResponse): void {
  const entry = pending.get(resp.requestId);
  if (!entry) return;

  clearTimeout(entry.timer);
  pending.delete(resp.requestId);
  entry.resolve(resp);
}

/**
 * Cancel all pending requests for a specific run (e.g. on abort).
 * Each pending request resolves as denied.
 */
export function cancelPendingRequests(runId: string): void {
  for (const [requestId, entry] of pending) {
    if (entry.runId === runId) {
      clearTimeout(entry.timer);
      pending.delete(requestId);
      entry.resolve({ requestId, approved: false });
    }
  }
}

/**
 * Cancel every pending request (e.g. on shutdown).
 */
export function clearAllPendingRequests(): void {
  for (const [requestId, entry] of pending) {
    clearTimeout(entry.timer);
    entry.resolve({ requestId, approved: false });
  }
  pending.clear();
}
