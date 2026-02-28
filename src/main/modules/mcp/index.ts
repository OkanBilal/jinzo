// IPC Handlers
export { registerMcpHandlers, unregisterMcpHandlers } from "./mcp.ipc";

// Controller
export { mcpController } from "./mcp.controller";

// Service
export {
  mcpService,
  getAllTools,
  formatToolsForResponse,
  getToolByName,
  executeToolByName,
} from "./mcp.service";

// Client
export { FeedMCPClient, getMCPClient } from "./mcp.client";

// DTOs
export type {
  OllamaToolDefinition,
  OllamaToolFunction,
  FormattedTool,
  CallToolPayload,
  MCPToolResponse,
  SyncResult,
  SpaceSwitchResult,
  JournalAppendResult,
  JournalMetadata,
  EntityListParams,
  EntitySearchParams,
} from "./mcp.dto";

// Helpers
export {
  isSyncTool,
  isSpaceTool,
  isJournalTool,
  isEntityTool,
} from "./mcp.helpers";

// Tools
export {
  // Entity tools
  entityList,
  entitySearch,
  executeEntityTool,
  ENTITY_TOOLS,
  
  // Sync tools
  triggerEntitySync,
  
  // Space tools
  switchToJournalSpace,
  switchToChatSpace,
  executeSpaceTool,
  SPACE_TOOLS,
  
  // Journal tools
  appendToJournal,
  executeJournalTool,
  JOURNAL_TOOLS,
} from "./tools";
