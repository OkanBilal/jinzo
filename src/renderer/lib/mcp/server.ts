import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { executeFeedTool } from "./tools/feed-tools";
import { executeCronTool } from "./tools/cron-tools";

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
    "feed_list",
    "View existing feed items in the database with optional filtering. Does NOT fetch new items - use trigger_feed_sync for that",
    {
      limit: z
        .number()
        .optional()
        .describe("Maximum number of items to return (default: 10)"),
      offset: z
        .number()
        .optional()
        .describe("Number of items to skip for pagination (default: 0)"),
      sources: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by sources (e.g., ['github', 'hackernews', 'raindrop'])"
        ),
      itemTypes: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by item types (e.g., ['repository', 'article', 'bookmark'])"
        ),
      startDate: z
        .string()
        .optional()
        .describe("Filter items from this date onwards (ISO 8601 format)"),
      endDate: z
        .string()
        .optional()
        .describe("Filter items up to this date (ISO 8601 format)"),
    },
    async (params) => {
      try {
        const result = await executeFeedTool("feed_list", params);
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
    "feed_search",
    "Search existing stored feed items by keyword. Use trigger_feed_sync first to get latest data",
    {
      query: z
        .string()
        .describe("Search query to match against title, description, or URL"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results to return (default: 10)"),
      sources: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by sources (e.g., ['github', 'hackernews', 'raindrop'])"
        ),
      itemTypes: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by item types (e.g., ['repository', 'article', 'bookmark'])"
        ),
      startDate: z
        .string()
        .optional()
        .describe("Filter items from this date onwards (ISO 8601 format)"),
      endDate: z
        .string()
        .optional()
        .describe("Filter items up to this date (ISO 8601 format)"),
    },
    async (params) => {
      try {
        const result = await executeFeedTool("feed_search", params);
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
    "trigger_feed_sync",
    "Sync/refresh/update feeds - fetches new items from external sources (GitHub, Hacker News, Raindrop, RSS)",
    {},
    async (params) => {
      try {
        const result = await executeCronTool("trigger_feed_sync", params);
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
