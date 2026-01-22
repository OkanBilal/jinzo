import ollama from "ollama";

import { getChatConfig } from "../config";
import {
  sendStreamChunk,
  sendStreamFinal,
  mergeOptionsWithConfig,
  getStructuredSchema,
  buildStructuredSystemPrompt,
  saveMessage,
  getConversationHistory,
} from "../utils";
import { ChatOptions } from "../types";

const CHAT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

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
      queryType: "chat",
      totalRetrieved: 0,
      usedInContext: 0,
      cached: false,
    },
  });
}
