import { toolsService } from "./tools.service";
import type {
  CreateToolPayload,
  UpdateToolPayload,
  CreateToolCallPayload,
  UpdateToolCallPayload,
  ToolSource,
} from "./tools.dto";

// ─────────────────────────────────────────────────────────────
// Tools Controller
// ─────────────────────────────────────────────────────────────
export const toolsController = {
  // Tool Operations
  getAllTools: () => toolsService.getAllTools(),
  getToolById: (id: string) => toolsService.getToolById(id),
  getToolsBySource: (source: ToolSource) => toolsService.getToolsBySource(source),
  getEnabledTools: () => toolsService.getEnabledTools(),
  createTool: (payload: CreateToolPayload) => toolsService.createTool(payload),
  updateTool: (id: string, payload: UpdateToolPayload) => toolsService.updateTool(id, payload),
  deleteTool: (id: string) => toolsService.deleteTool(id),

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
