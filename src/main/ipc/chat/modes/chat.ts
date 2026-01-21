import ollama from "ollama";

import type { ChatOptions } from "../../../../renderer/lib/chat";
import { saveMessage } from "../../../../renderer/lib/chat";
import { getChatConfig } from "../config";
import {
  sendStreamChunk,
  sendStreamFinal,
  mergeOptionsWithConfig,
  getStructuredSchema,
  buildStructuredSystemPrompt,
} from "../utils";

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

  let fullAnswer = "";

  if (structuredSchema) {
    const enhancedPrompt = buildStructuredSystemPrompt(CHAT_SYSTEM_PROMPT, structuredSchema);
    console.log("Using structured output schema");

    const response = await ollama.chat({
      model,
      stream: false,
      messages: [
        { role: "system", content: enhancedPrompt },
        { role: "user", content: question },
      ],
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
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
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
