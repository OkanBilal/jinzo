import ollama from "ollama";
import type { Message, Tool } from "ollama";

import { getChatConfig } from "../config";
import { sendStreamChunk, sendStreamFinal, mergeOptionsWithConfig, saveMessage, getConversationHistory } from "../utils";
import { ChatOptions } from "../types";
import { getMCPClient } from "../../mcp/utils/index";

const MCP_SYSTEM_PROMPT =
  "You are a helpful assistant with access to management tools. Use the available tools to answer user questions about their management items.";

const MAX_TOOL_ITERATIONS = 5;

export async function handleMCPMode(
  question: string,
  model: string,
  sessionId: number,
  options: ChatOptions,
  senderId: number
): Promise<void> {
  const config = getChatConfig();
  const mergedOptions = mergeOptionsWithConfig(options, config);
  const mcpClient = getMCPClient();
  const tools = mcpClient.getTools();

  // Fetch conversation history to maintain context across messages
  const history = await getConversationHistory(sessionId, { maxPairs: 10 });

  const messages: Message[] = [
    { role: "system", content: MCP_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: question },
  ];

  let fullAnswer = "";
  const toolCalls: Array<{ tool: string; params: any; result: any }> = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await ollama.chat({
      model,
      stream: false,
      messages,
      tools: tools as Tool[],
      options: {
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.top_p,
      },
    });

    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      messages.push(response.message);

      for (const toolCall of response.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolParams = toolCall.function.arguments;

        console.log(`Executing tool: ${toolName}`, toolParams);

        try {
          const result = await mcpClient.executeTool(toolName, toolParams);
          toolCalls.push({ tool: toolName, params: toolParams, result });
          messages.push({ role: "tool", content: JSON.stringify(result) });
        } catch (error: any) {
          console.error(`Tool execution failed: ${toolName}`, error);
          const errorMsg = `Error executing ${toolName}: ${error.message}`;
          messages.push({ role: "tool", content: errorMsg });
        }
      }
      continue;
    }

    if (response.message.content) {
      const streamResponse = await ollama.chat({
        model,
        stream: true,
        messages,
        options: {
          temperature: mergedOptions.temperature,
          top_p: mergedOptions.top_p,
        },
      });

      for await (const part of streamResponse) {
        const delta = part.message?.content || "";
        if (delta) {
          fullAnswer += delta;
          sendStreamChunk(senderId, sessionId, delta);
        }
      }
    }
    break;
  }

  if (fullAnswer) {
    await saveMessage(sessionId, "assistant", fullAnswer, model);
  }

  sendStreamFinal(senderId, {
    answer: fullAnswer,
    sources: [],
    sessionId,
    metadata: {
      queryType: "mcp",
      totalRetrieved: 0,
      usedInContext: toolCalls.length,
      cached: false,
      breakdown: toolCalls.reduce(
        (acc, tc) => {
          acc[tc.tool] = (acc[tc.tool] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    },
  });
}
