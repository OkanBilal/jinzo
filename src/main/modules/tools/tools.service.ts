import { toolsRepo } from "./tools.repo";
import type {
  CreateToolPayload,
  UpdateToolPayload,
  ToolResponse,
  CreateToolCallPayload,
  UpdateToolCallPayload,
  ToolCallResponse,
  SpaceToolPermissionPayload,
  SpaceToolPermissionResponse,
  ServiceResponse,
  ToolSource,
} from "./tools.dto";

// ─────────────────────────────────────────────────────────────
// Tools Service
// ─────────────────────────────────────────────────────────────
export const toolsService = {
  // ─────────────────────────────────────────────────────────────
  // Tool Operations
  // ─────────────────────────────────────────────────────────────
  async getAllTools(): Promise<ServiceResponse<ToolResponse[]>> {
    try {
      const tools = await toolsRepo.findAllTools();
      return { success: true, data: tools };
    } catch (error) {
      console.error("[ToolsService] Failed to get all tools:", error);
      return { success: false, error: "Failed to get tools" };
    }
  },

  async getToolById(id: string): Promise<ServiceResponse<ToolResponse>> {
    try {
      const tool = await toolsRepo.findToolById(id);
      if (!tool) {
        return { success: false, error: "Tool not found" };
      }
      return { success: true, data: tool };
    } catch (error) {
      console.error(`[ToolsService] Failed to get tool ${id}:`, error);
      return { success: false, error: "Failed to get tool" };
    }
  },

  async getToolsBySource(source: ToolSource): Promise<ServiceResponse<ToolResponse[]>> {
    try {
      const tools = await toolsRepo.findToolsBySource(source);
      return { success: true, data: tools };
    } catch (error) {
      console.error(`[ToolsService] Failed to get tools by source ${source}:`, error);
      return { success: false, error: "Failed to get tools" };
    }
  },

  async getToolsByMcpServer(mcpServerId: string): Promise<ServiceResponse<ToolResponse[]>> {
    try {
      const tools = await toolsRepo.findToolsByMcpServer(mcpServerId);
      return { success: true, data: tools };
    } catch (error) {
      console.error(`[ToolsService] Failed to get tools for MCP server ${mcpServerId}:`, error);
      return { success: false, error: "Failed to get tools" };
    }
  },

  async getEnabledTools(): Promise<ServiceResponse<ToolResponse[]>> {
    try {
      const tools = await toolsRepo.findEnabledTools();
      return { success: true, data: tools };
    } catch (error) {
      console.error("[ToolsService] Failed to get enabled tools:", error);
      return { success: false, error: "Failed to get tools" };
    }
  },

  async createTool(payload: CreateToolPayload): Promise<ServiceResponse<string>> {
    try {
      const existing = await toolsRepo.findToolById(payload.id);
      if (existing) {
        return { success: false, error: "Tool with this ID already exists" };
      }
      const id = await toolsRepo.insertTool(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[ToolsService] Failed to create tool:", error);
      return { success: false, error: "Failed to create tool" };
    }
  },

  async updateTool(id: string, payload: UpdateToolPayload): Promise<ServiceResponse<ToolResponse>> {
    try {
      const updated = await toolsRepo.updateTool(id, payload);
      if (!updated) {
        return { success: false, error: "Tool not found" };
      }
      return { success: true, data: updated };
    } catch (error) {
      console.error(`[ToolsService] Failed to update tool ${id}:`, error);
      return { success: false, error: "Failed to update tool" };
    }
  },

  async deleteTool(id: string): Promise<ServiceResponse<void>> {
    try {
      await toolsRepo.deleteTool(id);
      return { success: true };
    } catch (error) {
      console.error(`[ToolsService] Failed to delete tool ${id}:`, error);
      return { success: false, error: "Failed to delete tool" };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Tool Call Operations
  // ─────────────────────────────────────────────────────────────
  async getToolCallsByRun(runId: string): Promise<ServiceResponse<ToolCallResponse[]>> {
    try {
      const calls = await toolsRepo.findToolCallsByRun(runId);
      return { success: true, data: calls };
    } catch (error) {
      console.error(`[ToolsService] Failed to get tool calls for run ${runId}:`, error);
      return { success: false, error: "Failed to get tool calls" };
    }
  },

  async getToolCallsByAccount(
    accountId: string,
    limit?: number
  ): Promise<ServiceResponse<ToolCallResponse[]>> {
    try {
      const calls = await toolsRepo.findToolCallsByAccount(accountId, limit);
      return { success: true, data: calls };
    } catch (error) {
      console.error(`[ToolsService] Failed to get tool calls for account ${accountId}:`, error);
      return { success: false, error: "Failed to get tool calls" };
    }
  },

  async createToolCall(payload: CreateToolCallPayload): Promise<ServiceResponse<number>> {
    try {
      const id = await toolsRepo.insertToolCall(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[ToolsService] Failed to create tool call:", error);
      return { success: false, error: "Failed to create tool call" };
    }
  },

  async updateToolCall(id: number, payload: UpdateToolCallPayload): Promise<ServiceResponse<void>> {
    try {
      await toolsRepo.updateToolCall(id, payload);
      return { success: true };
    } catch (error) {
      console.error(`[ToolsService] Failed to update tool call ${id}:`, error);
      return { success: false, error: "Failed to update tool call" };
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

  // ─────────────────────────────────────────────────────────────
  // Space Tool Permissions
  // ─────────────────────────────────────────────────────────────
  async getPermissionsBySpace(spaceId: string): Promise<ServiceResponse<SpaceToolPermissionResponse[]>> {
    try {
      const permissions = await toolsRepo.findPermissionsBySpace(spaceId);
      return { success: true, data: permissions };
    } catch (error) {
      console.error(`[ToolsService] Failed to get permissions for space ${spaceId}:`, error);
      return { success: false, error: "Failed to get permissions" };
    }
  },

  async setPermission(payload: SpaceToolPermissionPayload): Promise<ServiceResponse<void>> {
    try {
      await toolsRepo.upsertPermission(payload);
      return { success: true };
    } catch (error) {
      console.error("[ToolsService] Failed to set permission:", error);
      return { success: false, error: "Failed to set permission" };
    }
  },

  async removePermission(spaceId: string, toolId: string): Promise<ServiceResponse<void>> {
    try {
      await toolsRepo.deletePermission(spaceId, toolId);
      return { success: true };
    } catch (error) {
      console.error(`[ToolsService] Failed to remove permission:`, error);
      return { success: false, error: "Failed to remove permission" };
    }
  },
};
