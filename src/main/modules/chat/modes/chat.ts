import ollama from "ollama";
import type { Message, Tool } from "ollama";

import { getChatConfig } from "../chat.config";
import {
  sendStreamChunk,
  sendStreamFinal,
  sendToolStatus,
  mergeOptionsWithConfig,
  getStructuredSchema,
  buildStructuredSystemPrompt,
  saveMessage,
  getConversationHistory,
  WEB_SEARCH_TOOLS,
  executeWebTool,
} from "../utils";
import type { ChatOptions } from "../chat.dto";
import { providersRepo } from "../../providers/providers.repo";

const CHAT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

const MAX_WEB_SEARCH_ITERATIONS = 8;

async function getOllamaApiKey(): Promise<string | null> {
  const provider = await providersRepo.findById("ollama");
  if (!provider?.config) return null;
  const config = typeof provider.config === "string" ? JSON.parse(provider.config) : provider.config;
  return config.ollamaApiKey || null;
}

export async function handleChatMode(
  question: string,
  model: string,
  sessionId: number,
  options: ChatOptions,
  senderId: number
): Promise<void> {
  const config = getChatConfig();
  const mergedOptions = mergeOptionsWithConfig(options, config);
  const structuredSchema = getStructuredSchema(options, config);

  const webSearchEnabled = options.webSearchEnabled ?? config.webSearchEnabled;

  // Fetch conversation history to maintain context across messages
  const history = await getConversationHistory(sessionId, { maxPairs: 10 });

  // Build messages array with system prompt, history, and current question
  const baseMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: question },
  ];

  let fullAnswer = "";

  if (structuredSchema) {
    const enhancedPrompt = buildStructuredSystemPrompt(CHAT_SYSTEM_PROMPT, structuredSchema);
    console.log("Using structured output schema");

    const structuredMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: enhancedPrompt },
      ...history,
      { role: "user", content: question },
    ];

    const response = await ollama.chat({
      model,
      stream: false,
      messages: structuredMessages,
      format: "json",
      options: {
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.top_p,
      },
    });

    fullAnswer = response.message.content || "";
    sendStreamChunk(senderId, sessionId, fullAnswer);
  } else if (webSearchEnabled) {
    // Web search mode: use tool call loop similar to MCP mode
    const apiKey = await getOllamaApiKey();
    if (!apiKey) {
      fullAnswer = "Web search is enabled but no Ollama API key is configured. Please set your API key in the web search dropdown.";
      sendStreamChunk(senderId, sessionId, fullAnswer);
    } else {
      const messages: Message[] = [
        { role: "system", content: CHAT_SYSTEM_PROMPT + "\n\nYou have access to web search tools. Use them when the user asks about current events, recent information, or anything that requires up-to-date data." },
        ...history,
        { role: "user", content: question },
      ];

      let didToolCalls = false;

      sendToolStatus(senderId, sessionId, "", "Thinking...");

      for (let i = 0; i < MAX_WEB_SEARCH_ITERATIONS; i++) {

        const response = await ollama.chat({
          model,
          stream: false,
          messages,
          tools: WEB_SEARCH_TOOLS as Tool[],
          options: {
            temperature: mergedOptions.temperature,
            top_p: mergedOptions.top_p,
          },
        });

        const hasToolCalls = response.message.tool_calls && response.message.tool_calls.length > 0;

        if (hasToolCalls) {
          didToolCalls = true;
          messages.push(response.message);

          for (const toolCall of response.message.tool_calls!) {
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;
            //TODO: improve status label for web_fetch calls to show the URL being fetched
            const statusLabel = toolName === "web_search"
              ? `Searching: ${toolArgs.query}`
              : `Reading: ${toolArgs.url}`;
            sendToolStatus(senderId, sessionId, toolName, statusLabel);

            try {
              const result = await executeWebTool(toolName, toolArgs, apiKey);
              messages.push({ role: "tool", content: result });
            } catch (error: any) {
              messages.push({ role: "tool", content: `Error: ${error.message}` });
            }
          }
          sendToolStatus(senderId, sessionId, "", "Thinking...");
          continue;
        }

        // No tool calls — use the response content directly if we already did tool calls
        if (didToolCalls && response.message.content) {
          fullAnswer = response.message.content;
          sendStreamChunk(senderId, sessionId, fullAnswer);
        } else {
          // Stream a fresh response (no tool calls were ever made, or content was empty)
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
    }
  } else {
    const llmStream = await ollama.chat({
      model,
      stream: true,
      messages: baseMessages,
      options: {
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.top_p,
      },
    });

    for await (const part of llmStream) {
      const delta = part.message?.content || "";
      if (delta) {
        fullAnswer += delta;
        sendStreamChunk(senderId, sessionId, delta);
      }
    }
  }

  if (fullAnswer) {
    await saveMessage(sessionId, "assistant", fullAnswer, model);
  }

  sendStreamFinal(senderId, {
    answer: fullAnswer,
    sources: [],
    sessionId,
    metadata: {
      queryType: webSearchEnabled ? "chat-web-search" : "chat",
      totalRetrieved: 0,
      usedInContext: 0,
      cached: false,
    },
  });
}
