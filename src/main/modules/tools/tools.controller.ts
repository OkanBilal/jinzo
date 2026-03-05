import { toolsService } from "./tools.service";
import type {
  CreateToolCallPayload,
  UpdateToolCallPayload,
} from "./tools.dto";

// ─────────────────────────────────────────────────────────────
// Tools Controller
// ─────────────────────────────────────────────────────────────
export const toolsController = {
  // Tool Call Operations
  getToolCallsByRun: (runId: string) => toolsService.getToolCallsByRun(runId),
  getToolCallsByAccount: (accountId: string, limit?: number) =>
    toolsService.getToolCallsByAccount(accountId, limit),
  createToolCall: (payload: CreateToolCallPayload) => toolsService.createToolCall(payload),
  updateToolCall: (id: number, payload: UpdateToolCallPayload) =>
    toolsService.updateToolCall(id, payload),
  startToolCall: (id: number) => toolsService.startToolCall(id),
  completeToolCall: (id: number, output: Record<string, unknown>, latencyMs?: number) =>
    toolsService.completeToolCall(id, output, latencyMs),
  failToolCall: (id: number, error: string) => toolsService.failToolCall(id, error),

};
