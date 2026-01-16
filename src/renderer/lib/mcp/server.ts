import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { executeEntityTool } from "./tools/feed-tools";
import { executeSyncTool } from "./tools/cron-tools";
import { executeMoodTool } from "./tools/mood-tools";

let serverInstance: McpServer | null = null;

export function createFeedMCPServer(): McpServer {
  if (serverInstance) {
    return serverInstance;
  }

  const server = new McpServer(
    {
      name: "feed-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.tool(
    "entity_list",
    "View existing entities in the database with optional filtering. Does NOT fetch new items - use trigger_entity_sync for that",
    {
      limit: z
        .number()
        .optional()
        .describe("Maximum number of entities to return (default: 10)"),
      offset: z
        .number()
        .optional()
        .describe("Number of entities to skip for pagination (default: 0)"),
      kinds: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by entity kinds (e.g., ['issue', 'bookmark', 'podcast_episode'])"
        ),
      connectionIds: z
        .array(z.string())
        .optional()
        .describe("Filter by connection IDs"),
      startDate: z
        .string()
        .optional()
        .describe("Filter entities from this date onwards (ISO 8601 format)"),
      endDate: z
        .string()
        .optional()
        .describe("Filter entities up to this date (ISO 8601 format)"),
    },
    async (params) => {
      try {
        const result = await executeEntityTool("entity_list", params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error.message || "Tool execution failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "entity_search",
    "Search existing stored entities by keyword. Use trigger_entity_sync first to get latest data",
    {
      query: z
        .string()
        .describe("Search query to match against title, body, summary, or URL"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results to return (default: 10)"),
      kinds: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by entity kinds (e.g., ['issue', 'bookmark', 'podcast_episode'])"
        ),
      connectionIds: z
        .array(z.string())
        .optional()
        .describe("Filter by connection IDs"),
      startDate: z
        .string()
        .optional()
        .describe("Filter entities from this date onwards (ISO 8601 format)"),
      endDate: z
        .string()
        .optional()
        .describe("Filter entities up to this date (ISO 8601 format)"),
    },
    async (params) => {
      try {
        const result = await executeEntityTool("entity_search", params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error.message || "Tool execution failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "trigger_entity_sync",
    "Sync/refresh/update entities - fetches new items from external sources (GitHub, Hacker News, Raindrop, RSS, Podcasts)",
    {},
    async (params) => {
      try {
        const result = await executeSyncTool("trigger_entity_sync", params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error.message || "Tool execution failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "switch_to_writing_mood",
    "Switch to writing mood to activate the BlockNote editor for document editing",
    {},
    async (params) => {
      try {
        const result = await executeMoodTool("switch_to_writing_mood", params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error.message || "Tool execution failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "switch_to_chat_mood",
    "Switch to chat mood to activate the chat interface for conversations",
    {},
    async (params) => {
      try {
        const result = await executeMoodTool("switch_to_chat_mood", params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error.message || "Tool execution failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  serverInstance = server;
  return server;
}

export async function runFeedMCPServer(): Promise<void> {
  const server = createFeedMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Feed MCP Server running on stdio");
}

export function getFeedMCPServer(): McpServer {
  return createFeedMCPServer();
}

if (require.main === module) {
  runFeedMCPServer().catch(console.error);
}
