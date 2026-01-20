import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { useGetAppsQuery } from "@/lib/redux/api";
import { useThinkingConfig } from "@/features/chat/hooks/use-thinking-config";
import { ChatMessages } from "@/features/chat/components";
import ChatInput from "@/features/chat/components/input";
import { AppState } from "@/features/chat/components/input/types";
import { useChat } from "@/features/chat/hooks/use-chat";
import { Caption } from "@/components/ui/text";

export function JournalContent() {
  const selectedModel = useAppSelector((state) => state.chat.selectedModel);
  const thinkingEnabled = useAppSelector((state) => state.chat.thinkingEnabled);
  const thinkingLevel = useAppSelector((state) => state.chat.thinkingLevel);
  const toolMode = useAppSelector((state) => state.chat.toolMode);
  const structuredOutputEnabled = useAppSelector(
    (state) => state.chat.structuredOutputEnabled,
  );
  const structuredOutputSchema = useAppSelector(
    (state) => state.chat.structuredOutputSchema,
  );

  // Get current journal editing context from Redux
  const journalEditing = useAppSelector((state) => state.journalEditing);

  const thinkingConfig = useThinkingConfig();

  const [selectedApp, setSelectedApp] = useState<AppState | null>(null);
  const { data: apps = [] } = useGetAppsQuery();

  const {
    messages,
    input,
    setInput,
    isLoading,
    sendTextStreaming,
    focusInput,
    addMessage,
    refs: { messagesRef },
  } = useChat({ initialMessages: [] });

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  // Build context-aware prompt
  const buildContextPrompt = useCallback(
    (userMessage: string): string => {
      if (!journalEditing.entityId || !journalEditing.body) {
        return userMessage;
      }
      // TODO: Check prompt
      // Create a context-aware prompt that includes the journal content
      const contextPrefix = `[CONTEXT: The user is writing a journal entry titled "${journalEditing.title}". Here is the current content of their journal:

---
${journalEditing.body}
---

The user's question/request about their writing:]

`;

      return contextPrefix + userMessage;
    },
    [journalEditing],
  );

  const handleSend = useCallback((): void => {
    if (!input.trim()) return;

    const userInput = input.trim();

    // Add the user's original message to the UI
    addMessage({ role: "user", text: userInput });

    // Build the context-aware prompt for the LLM
    const contextPrompt = buildContextPrompt(userInput);

    // Send with context but skip adding user message (we already added it)
    sendTextStreaming(contextPrompt, selectedModel, null, {
      skipUserMessage: true,
      requestOptions: {
        mode: toolMode,
        thinkingEnabled: thinkingConfig.shouldShowThinkingToggle
          ? thinkingEnabled
          : undefined,
        thinkingLevel: thinkingConfig.shouldShowThinkingLevel
          ? thinkingLevel
          : undefined,
        structuredOutputEnabled,
        structuredOutputSchema,
      },
    });

    setInput("");
  }, [
    input,
    selectedModel,
    sendTextStreaming,
    toolMode,
    thinkingConfig,
    thinkingEnabled,
    thinkingLevel,
    structuredOutputEnabled,
    structuredOutputSchema,
    buildContextPrompt,
    addMessage,
    setInput,
  ]);

  // Show context indicator when journal is being edited
  const hasJournalContext = Boolean(
    journalEditing.entityId && journalEditing.body,
  );

  return (
    <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 dark:bg-primary-950/50 bg-primary mx-3 -pb-4 rounded-2xl overflow-hidden">
      {/* Context indicator */}
      {hasJournalContext && (
        <div className="shrink-0 px-4 py-2 border-b border-primary-200/50 dark:border-primary-800/50">
          <Caption className="text-primary-500 dark:text-primary-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Context: {journalEditing.title || "Untitled"} (
            {journalEditing.wordCount} words)
          </Caption>
        </div>
      )}

      <div className="flex-1 overflow-hidden p-3">
        <ChatMessages
          ref={messagesRef}
          messages={messages}
          isLoading={isLoading}
        />
      </div>
      <div className="shrink-0 p-3 pb-6">
        <ChatInput
          apps={apps}
          query={input}
          onQueryChange={setInput}
          onSubmit={handleSend}
          loading={isLoading}
          placeholder={
            hasJournalContext ? "Ask about your writing..." : "Message"
          }
          isChatPage={true}
          selectedApp={selectedApp}
          onSelectedAppChange={setSelectedApp}
        />
      </div>
    </div>
  );
}
