import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { useGetAppsQuery } from "@/lib/redux/api";
import { useThinkingConfig } from "@/features/chat/hooks/use-thinking-config";
import { ChatMessages } from "@/features/chat/components";
import ChatInput from "@/features/chat/components/input";
import { AppState } from "@/features/chat/components/input/types";
import { useChat } from "@/features/chat/hooks/use-chat";
import { Edit } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

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
    clearMessages,
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
      // TODO: Optimize prompt construction
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

  const handleNewChat = () => {
    clearMessages();
    setInput("");
    focusInput();
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 dark:bg-primary-950 bg-primary mx-2 -pb-4 rounded-2xl overflow-hidden">
      <Button
        onClick={handleNewChat}
        className="absolute top-2.5 right-12 rounded-full! p-2! text-primary-900 dark:text-primary-300!  bg-primary-100/30 dark:bg-primary/5 "
        title="New chat"
      >
        <Edit className="size-4  text-primary-900 dark:text-primary-200" />
      </Button>
      {hasJournalContext && <div className="shrink-0 px-4 py-2 "></div>}

      <div className="flex-1 overflow-hidden mt-4 p-3">
        <ChatMessages
          ref={messagesRef}
          messages={messages}
          isLoading={isLoading}
        />
      </div>
      <div className="shrink-0 px-2 pb-4">
        <ChatInput
          context={journalEditing}
          query={input}
          onQueryChange={setInput}
          onSubmit={handleSend}
          loading={isLoading}
          placeholder={
            hasJournalContext ? "Ask about your writing..." : "Message"
          }
        />
      </div>
    </div>
  );
}
