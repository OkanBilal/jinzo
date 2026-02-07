import ollama from "ollama";

import { getChatConfig } from "../chat.config";
import { NO_RELEVANT_CONTENT_SYSTEM_PROMPT } from "../chat.constants";
import {
  sendStreamChunk,
  sendStreamFinal,
  mergeOptionsWithConfig,
  getStructuredSchema,
  buildStructuredSystemPrompt,
  saveMessage,
  getConversationHistory,
  estimateTokens,
  calculateHistoryTokenBudget,
} from "../utils";
import type { ChatOptions, ChatResponse } from "../chat.dto";
import { analyzeQuery, buildOptimizedPrompt, findRelevantEntities } from "../utils/rag";

export async function handleRAGMode(
  question: string,
  model: string,
  sessionId: number,
  options: ChatOptions,
  senderId: number
): Promise<void> {
  const config = getChatConfig();
  const mergedOptions = mergeOptionsWithConfig(options, config);

  const qa = analyzeQuery(question);
  //console.log("Analyzed query:", qa);

  const relevant = await findRelevantEntities(question, {
    topK: mergedOptions.topK,
    minScore: mergedOptions.minScore,
    semanticWeight: 0.7,
    keywordWeight: 0.3,
    recencyWeight: 0.1,
    rerank: true,
    sourceFilter:
      qa.detectedSources.length > 0 ? qa.detectedSources : mergedOptions.sourceFilter,
    itemTypeFilter:
      qa.detectedItemTypes.length > 0
        ? qa.detectedItemTypes
        : mergedOptions.itemTypeFilter,
  });

  //console.log(`Found ${relevant.length} relevant items for question.`);

  let systemPrompt = "";
  let userPrompt = "";
  let sources: ChatResponse["sources"] = [];
  let metadata: ChatResponse["metadata"];

  if (relevant.length === 0) {
    systemPrompt = NO_RELEVANT_CONTENT_SYSTEM_PROMPT;
    userPrompt = question;
    metadata = {
      queryType: "standard",
      totalRetrieved: 0,
      usedInContext: 0,
      cached: false,
    };
  } else {
    const optimized = buildOptimizedPrompt(question, relevant, {
      maxTokens: 3000,
      includeMetadata: mergedOptions.includeMetadata ?? false,
      prioritizeSources: mergedOptions.prioritizeSources,
    });

    systemPrompt = optimized.systemPrompt;
    userPrompt = optimized.userPrompt;
    sources = optimized.usedItems.map((item) => ({
      title: item.title,
      url: item.url,
      source: item.kind,
      itemType: item.kind,
      date: item.occurredAt,
      score: item.score,
      semanticScore: item.semanticScore,
      keywordScore: item.keywordScore,
    }));

    metadata = {
      queryType: "standard",
      totalRetrieved: relevant.length,
      usedInContext: optimized.usedItems.length,
      cached: false,
      appliedFilters: {
        sources:
          (qa.detectedSources.length > 0
            ? qa.detectedSources
            : mergedOptions.sourceFilter) || [],
        itemTypes:
          (qa.detectedItemTypes.length > 0
            ? qa.detectedItemTypes
            : mergedOptions.itemTypeFilter) || [],
        topK: mergedOptions.topK,
      },
      detectedFromQuery: {
        sources: qa.detectedSources,
        itemTypes: qa.detectedItemTypes,
      },
    };
  }

  const structuredSchema = getStructuredSchema(options, config);
  let fullAnswer = "";

  // Calculate token budget for history based on system prompt and user prompt size
  const systemPromptTokens = estimateTokens(systemPrompt);
  const userPromptTokens = estimateTokens(userPrompt);
  const historyTokenBudget = calculateHistoryTokenBudget(systemPromptTokens, userPromptTokens);

  // Fetch conversation history with token-based limiting to avoid prompt too long errors
  const history = await getConversationHistory(sessionId, { maxTokens: historyTokenBudget });

  // Build messages array with system prompt, history, and current question with RAG context
  const baseMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userPrompt },
  ];

  if (structuredSchema) {
    const enhancedPrompt = buildStructuredSystemPrompt(systemPrompt, structuredSchema);
    //console.log("Using structured output schema");

    const structuredMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: enhancedPrompt },
      ...history,
      { role: "user", content: userPrompt },
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
    sources,
    sessionId,
    metadata,
  });
}
