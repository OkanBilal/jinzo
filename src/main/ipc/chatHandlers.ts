import { ipcMain, BrowserWindow } from "electron";
import { eq, desc } from "drizzle-orm";
import ollama from "ollama";
import type { Message, Tool } from "ollama";

import { getDb } from "../db/client";
import { chatSessions, chatMessages } from "../db/schema";
import {
  ChatRequestBody,
  ChatResponse,
  saveMessage,
  getCachedResponse,
  validateChatRequest,
  normalizeChatRequest,
  type StructuredOutputSchema,
} from "../../renderer/lib/chat";
import { analyzeQuery, buildOptimizedPrompt, findRelevantFeedItems } from "../../renderer/lib/rag";
import { NO_RELEVANT_CONTENT_SYSTEM_PROMPT } from "../../renderer/lib/config";
import { getMCPClient } from "../../renderer/lib/mcp";
import { DEFAULT_MODEL } from "../../renderer/lib/config/chat";

// ============================================================================
// Chat Config Management
// ============================================================================


export interface ChatConfig {
  temperature: number;
  top_p: number;
  topK: number;
  minScore: number;
  selectedModel: string;
  toolMode: 'chat' | 'rag' | 'mcp';
  structuredOutputEnabled: boolean;
  structuredOutputSchema: StructuredOutputSchema;
}

const DEFAULT_CONFIG: ChatConfig = {
  temperature: 0.7,
  top_p: 0.9,
  topK: 10,
  minScore: 0.1,
  selectedModel: DEFAULT_MODEL,
  toolMode: 'chat',
  structuredOutputEnabled: false,
  structuredOutputSchema: { properties: [] },
};

let chatConfig: ChatConfig = { ...DEFAULT_CONFIG };

export function getChatConfig(): ChatConfig {
  return { ...chatConfig };
}

// ============================================================================
// Helper Functions
// ============================================================================


function buildJsonSchema(schema: StructuredOutputSchema): object {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const prop of schema.properties) {
    let propSchema: any;

    if (prop.isArray) {
      propSchema = {
        type: "array",
        items: { type: prop.type === "array" ? "string" : prop.type },
      };
    } else {
      propSchema = { type: prop.type };
    }

    properties[prop.name] = propSchema;

    if (prop.isRequired) {
      required.push(prop.name);
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}

async function handleMCPMode(
  question: string,
  model: string,
  sessionId: number,
  options: any,
  senderId: number
): Promise<void> {
  const config = getChatConfig();
  const mcpClient = getMCPClient();
  const tools = mcpClient.getTools();
  const window = BrowserWindow.fromId(senderId);

  const messages: Message[] = [
    {
      role: "system",
      content:
        "You are a helpful assistant with access to feed management tools. Use the available tools to answer user questions about their feed items.",
    },
    { role: "user", content: question },
  ];

  let fullAnswer = "";
  const toolCalls: Array<{ tool: string; params: any; result: any }> = [];

  for (let i = 0; i < 5; i++) {
    const response = await ollama.chat({
      model,
      stream: false,
      messages,
      tools: tools as Tool[],
      options: {
        temperature: options.temperature ?? config.temperature,
        top_p: options.top_p ?? config.top_p,
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
          temperature: options.temperature ?? config.temperature,
          top_p: options.top_p ?? config.top_p,
        },
      });

      for await (const part of streamResponse) {
        const delta = part.message?.content || "";
        if (delta) {
          fullAnswer += delta;
          window?.webContents.send('chat:stream-chunk', { sessionId, content: delta });
        }
      }
    }
    break;
  }

  if (fullAnswer) {
    await saveMessage(sessionId, "assistant", fullAnswer, model);
  }

  window?.webContents.send('chat:stream-final', {
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

async function handleChatMode(
  question: string,
  model: string,
  sessionId: number,
  options: any,
  senderId: number
): Promise<void> {
  const config = getChatConfig();
  const window = BrowserWindow.fromId(senderId);
  const systemPrompt = "You are a helpful AI assistant.";

  const useStructuredOutput =
    (options.structuredOutputEnabled ?? config.structuredOutputEnabled) &&
    (options.structuredOutputSchema ?? config.structuredOutputSchema)
      ?.properties?.length > 0;

  const structuredSchema =
    options.structuredOutputSchema ?? config.structuredOutputSchema;

  let fullAnswer = "";

  if (useStructuredOutput && structuredSchema) {
    const jsonSchema = buildJsonSchema(structuredSchema);
    console.log("Using structured output schema:", jsonSchema);

    const enhancedSystemPrompt = `${systemPrompt}

You MUST respond ONLY with valid JSON matching this exact schema:
${JSON.stringify(jsonSchema, null, 2)}

Do not include any text outside the JSON object. Your entire response must be parseable JSON.`;

    const response = await ollama.chat({
      model,
      stream: false,
      messages: [
        { role: "system", content: enhancedSystemPrompt },
        { role: "user", content: question },
      ],
      format: "json",
      options: {
        temperature: options.temperature ?? config.temperature,
        top_p: options.top_p ?? config.top_p,
      },
    });

    fullAnswer = response.message.content || "";
    window?.webContents.send('chat:stream-chunk', { sessionId, content: fullAnswer });
  } else {
    const llmStream = await ollama.chat({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      options: {
        temperature: options.temperature ?? config.temperature,
        top_p: options.top_p ?? config.top_p,
      },
    });

    for await (const part of llmStream) {
      const delta = part.message?.content || "";
      if (delta) {
        fullAnswer += delta;
        window?.webContents.send('chat:stream-chunk', { sessionId, content: delta });
      }
    }
  }

  if (fullAnswer) {
    await saveMessage(sessionId, "assistant", fullAnswer, model);
  }

  window?.webContents.send('chat:stream-final', {
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

async function handleRAGMode(
  question: string,
  model: string,
  sessionId: number,
  options: any,
  senderId: number
): Promise<void> {
  const config = getChatConfig();
  const window = BrowserWindow.fromId(senderId);
  const qa = analyzeQuery(question);
  console.log("Analyzed query:", qa);

  const relevant = await findRelevantFeedItems(question, {
    topK: options.topK ?? config.topK,
    minScore: options.minScore ?? config.minScore,
    semanticWeight: 0.7,
    keywordWeight: 0.3,
    recencyWeight: 0.1,
    rerank: true,
    sourceFilter:
      qa.detectedSources.length > 0 ? qa.detectedSources : options.sourceFilter,
    itemTypeFilter:
      qa.detectedItemTypes.length > 0
        ? qa.detectedItemTypes
        : options.itemTypeFilter,
  });

  console.log(`Found ${relevant.length} relevant items for question.`);

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
      includeMetadata: options.includeMetadata ?? false,
      prioritizeSources: options.prioritizeSources,
    });

    systemPrompt = optimized.systemPrompt;
    userPrompt = optimized.userPrompt;
    sources = optimized.usedItems.map((item) => ({
      title: item.title,
      url: item.url,
      source: item.source,
      itemType: item.itemType,
      date: item.date,
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
            : options.sourceFilter) || [],
        itemTypes:
          (qa.detectedItemTypes.length > 0
            ? qa.detectedItemTypes
            : options.itemTypeFilter) || [],
        topK: options.topK ?? 10,
      },
      detectedFromQuery: {
        sources: qa.detectedSources,
        itemTypes: qa.detectedItemTypes,
      },
    };
  }

  const useStructuredOutput =
    (options.structuredOutputEnabled ?? config.structuredOutputEnabled) &&
    (options.structuredOutputSchema ?? config.structuredOutputSchema)
      ?.properties?.length > 0;

  const structuredSchema =
    options.structuredOutputSchema ?? config.structuredOutputSchema;

  let fullAnswer = "";

  if (useStructuredOutput && structuredSchema) {
    const jsonSchema = buildJsonSchema(structuredSchema);
    console.log("Using structured output schema:", jsonSchema);

    const enhancedSystemPrompt = `${systemPrompt}

You MUST respond ONLY with valid JSON matching this exact schema:
${JSON.stringify(jsonSchema, null, 2)}

Do not include any text outside the JSON object. Your entire response must be parseable JSON.`;

    const response = await ollama.chat({
      model,
      stream: false,
      messages: [
        { role: "system", content: enhancedSystemPrompt },
        { role: "user", content: userPrompt },
      ],
      format: "json",
      options: {
        temperature: options.temperature ?? config.temperature,
        top_p: options.top_p ?? config.top_p,
      },
    });

    fullAnswer = response.message.content || "";
    window?.webContents.send('chat:stream-chunk', { sessionId, content: fullAnswer });
  } else {
    const llmStream = await ollama.chat({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      options: {
        temperature: options.temperature ?? config.temperature,
        top_p: options.top_p ?? config.top_p,
      },
    });

    for await (const part of llmStream) {
      const delta = part.message?.content || "";
      if (delta) {
        fullAnswer += delta;
        window?.webContents.send('chat:stream-chunk', { sessionId, content: delta });
      }
    }
  }

  if (fullAnswer) {
    await saveMessage(sessionId, "assistant", fullAnswer, model);
  }

  window?.webContents.send('chat:stream-final', {
    answer: fullAnswer,
    sources,
    sessionId,
    metadata,
  });
}

// ============================================================================
// IPC Handlers
// ============================================================================

export function registerChatHandlers() {
  // Get chat config
  ipcMain.handle("chat:getConfig", async () => {
    try {
      return { success: true, data: getChatConfig() };
    } catch (error) {
      console.error("Error getting chat config:", error);
      return { success: false, error: "Failed to get chat config" };
    }
  });

  // Update chat config
  ipcMain.handle("chat:updateConfig", async (_, payload: Partial<ChatConfig>) => {
    try {
      if (typeof payload.temperature === "number") {
        chatConfig.temperature = Math.max(0, Math.min(2, payload.temperature));
      }

      if (typeof payload.top_p === "number") {
        chatConfig.top_p = Math.max(0, Math.min(1, payload.top_p));
      }

      if (typeof payload.topK === "number") {
        chatConfig.topK = Math.max(1, Math.min(100, payload.topK));
      }

      if (typeof payload.minScore === "number") {
        chatConfig.minScore = Math.max(0, Math.min(1, payload.minScore));
      }

      if (typeof payload.selectedModel === "string") {
        chatConfig.selectedModel = payload.selectedModel;
      }

      if (payload.toolMode === 'chat' || payload.toolMode === 'rag' || payload.toolMode === 'mcp') {
        chatConfig.toolMode = payload.toolMode;
      }

      if (typeof payload.structuredOutputEnabled === 'boolean') {
        chatConfig.structuredOutputEnabled = payload.structuredOutputEnabled;
      }

      if (payload.structuredOutputSchema && Array.isArray(payload.structuredOutputSchema.properties)) {
        chatConfig.structuredOutputSchema = payload.structuredOutputSchema;
      }

      return { success: true, data: getChatConfig() };
    } catch (error: any) {
      console.error("Error updating chat config:", error);
      return { success: false, error: error?.message || "Failed to update config" };
    }
  });

  // Get chat sessions list
  ipcMain.handle("chat:getSessions", async () => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          id: chatSessions.id,
          title: chatSessions.title,
          initialQuery: chatSessions.initialQuery,
          model: chatSessions.model,
          createdAt: chatSessions.createdAt,
          updatedAt: chatSessions.updatedAt,
        })
        .from(chatSessions)
        .orderBy(desc(chatSessions.id))
        .limit(100);

      return {
        success: true,
        data: {
          sessions: rows.map((row) => ({
            id: row.id,
            title: row.title,
            initialQuery: row.initialQuery,
            model: row.model,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        },
      };
    } catch (error) {
      console.error("Failed to list chat sessions:", error);
      return { success: false, error: "Failed to list sessions" };
    }
  });

  // Get messages for a session
  ipcMain.handle("chat:getMessages", async (_, sessionId: number) => {
    try {
      const db = getDb();
      if (!sessionId || typeof sessionId !== "number" || sessionId <= 0) {
        return { success: false, error: "Invalid session ID" };
      }

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);

      return {
        success: true,
        data: {
          messages: messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          })),
        },
      };
    } catch (error) {
      console.error("Failed to load chat messages:", error);
      return { success: false, error: "Failed to load messages" };
    }
  });

  // Create chat session
  ipcMain.handle("chat:createSession", async (_, payload: ChatRequestBody) => {
    try {
      const db = getDb();
      const validation = validateChatRequest(payload);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { question, model } = normalizeChatRequest(payload);

      const sessionInsert = await db
        .insert(chatSessions)
        .values({
          initialQuery: question,
          model,
          title: question.slice(0, 60),
        })
        .returning({ id: chatSessions.id });

      if (!sessionInsert[0]) {
        throw new Error("Failed to create chat session: No ID returned");
      }

      const sessionId = sessionInsert[0].id;

      await saveMessage(sessionId, "user", question, model);

      return { success: true, data: { sessionId } };
    } catch (error: any) {
      console.error("Failed to create chat session:", error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  });

  // Delete chat session
  ipcMain.handle("chat:deleteSession", async (_, sessionId: number) => {
    try {
      const db = getDb();
      if (!sessionId || typeof sessionId !== "number") {
        return { success: false, error: "Invalid session ID" };
      }

      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, sessionId),
      });

      if (!session) {
        return { success: false, error: "Session not found" };
      }

      await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));

      return { success: true };
    } catch (error: any) {
      console.error("Failed to delete chat session:", error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  });

  // Chat with streaming (main handler)
  ipcMain.handle("chat:send", async (event, payload: ChatRequestBody) => {
    try {
      const validation = validateChatRequest(payload);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { question, model, sessionId, options } = normalizeChatRequest(payload);

      if (!options.skipUserSave) {
        await saveMessage(sessionId, "user", question, model);
      }

      const cached = getCachedResponse(
        question,
        model,
        sessionId,
        options.noCache
      );

      if (cached) {
        event.sender.send('chat:stream-chunk', { sessionId, content: cached.answer });
        event.sender.send('chat:stream-final', cached);
        return { success: true, cached: true };
      }

      const config = getChatConfig();
      const toolMode = (options as any).toolMode ?? config.toolMode;

      // Start streaming in background
      (async () => {
        try {
          if (toolMode === 'mcp') {
            await handleMCPMode(question, model, sessionId, options, event.sender.id);
          } else if (toolMode === 'rag') {
            await handleRAGMode(question, model, sessionId, options, event.sender.id);
          } else {
            await handleChatMode(question, model, sessionId, options, event.sender.id);
          }
        } catch (error: any) {
          console.error("Chat streaming error:", error);
          event.sender.send('chat:stream-error', { 
            sessionId, 
            error: error?.message || "Unknown error" 
          });
        }
      })();

      return { success: true, streaming: true };
    } catch (error: any) {
      console.error("Chat send error:", error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  });
}
