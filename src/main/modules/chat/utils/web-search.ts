import { Ollama } from "ollama";
import type { Tool } from "ollama";

export const webSearchTool: Tool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current information. Use this when the user asks about recent events, current data, or anything that may require up-to-date information.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
};

export const webFetchTool: Tool = {
  type: "function",
  function: {
    name: "web_fetch",
    description:
      "Fetch the contents of a specific web page URL. Use this to get detailed information from a specific webpage.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch content from",
        },
      },
      required: ["url"],
    },
  },
};

export const WEB_SEARCH_TOOLS: Tool[] = [webSearchTool, webFetchTool];


function createAuthenticatedClient(apiKey: string): Ollama {
  return new Ollama({
    host: "http://127.0.0.1:11434",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function executeWebTool(
  toolName: string,
  args: Record<string, any>,
  apiKey: string
): Promise<string> {
  const client = createAuthenticatedClient(apiKey);

  if (toolName === "web_search") {
    try {
      const response = await client.webSearch({ query: args.query });
      if (!response.results || response.results.length === 0) {
        return "No search results found.";
      }
      return response.results
        .map((r, i) => `[${i + 1}] ${r.content}`)
        .join("\n\n");
    } catch (error: any) {
      console.error("Web search error:", error);
      return `Web search error: ${error.message}`;
    }
  } else if (toolName === "web_fetch") {
    try {
      const response = await client.webFetch({ url: args.url });
      return response.content || "No content retrieved.";
    } catch (error: any) {
      console.error("Web fetch error:", error);
      return `Web fetch error: ${error.message}`;
    }
  }

  return `Unknown web tool: ${toolName}`;
}
