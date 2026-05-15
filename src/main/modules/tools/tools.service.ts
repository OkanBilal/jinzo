import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { toolsRepo } from "./tools.repo";
import type {
  CreateToolCallPayload,
  UpdateToolCallPayload,
  ToolCallResponse,
  ServiceResponse,
} from "./tools.dto";

// ─────────────────────────────────────────────────────────────
// Tools Service
// ─────────────────────────────────────────────────────────────
export const toolsService = {
  // ─────────────────────────────────────────────────────────────
  // Tool Call Operations
  // ─────────────────────────────────────────────────────────────
  async getToolCallsByRun(runId: string): Promise<ServiceResponse<ToolCallResponse[]>> {
    try {
      const calls = await toolsRepo.findToolCallsByRun(runId);
      return ok(calls);
    } catch (error) {
      console.error(`[ToolsService] Failed to get tool calls for run ${runId}:`, error);
      return fail("Failed to get tool calls");
    }
  },

  async getToolCallsByAccount(
    accountId: string,
    limit?: number
  ): Promise<ServiceResponse<ToolCallResponse[]>> {
    try {
      const calls = await toolsRepo.findToolCallsByAccount(accountId, limit);
      return ok(calls);
    } catch (error) {
      console.error(`[ToolsService] Failed to get tool calls for account ${accountId}:`, error);
      return fail("Failed to get tool calls");
    }
  },

  async createToolCall(payload: CreateToolCallPayload): Promise<ServiceResponse<number>> {
    try {
      const id = await toolsRepo.insertToolCall(payload);
      return ok(id);
    } catch (error) {
      console.error("[ToolsService] Failed to create tool call:", error);
      return fail("Failed to create tool call");
    }
  },

  async updateToolCall(id: number, payload: UpdateToolCallPayload): Promise<ServiceResponse<void>> {
    try {
      await toolsRepo.updateToolCall(id, payload);
      return ok(undefined);
    } catch (error) {
      console.error(`[ToolsService] Failed to update tool call ${id}:`, error);
      return fail("Failed to update tool call");
    }
  },

  async startToolCall(id: number): Promise<ServiceResponse<void>> {
    return this.updateToolCall(id, { status: "running", startedAt: new Date() });
  },

  async completeToolCall(
    id: number,
    output: Record<string, unknown>,
    latencyMs?: number
  ): Promise<ServiceResponse<void>> {
    return this.updateToolCall(id, {
      status: "done",
      output,
      endedAt: new Date(),
      latencyMs,
    });
  },

  async failToolCall(id: number, error: string): Promise<ServiceResponse<void>> {
    return this.updateToolCall(id, { status: "error", error, endedAt: new Date() });
  },

};
