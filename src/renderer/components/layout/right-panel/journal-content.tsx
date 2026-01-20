import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { useGetAppsQuery } from "@/lib/redux/api";
import { useThinkingConfig } from "@/features/chat/hooks/use-thinking-config";
import { ChatMessages } from "@/features/chat/components";
import ChatInput from "@/features/chat/components/input";
import { AppState } from "@/features/chat/components/input/types";
import { useChat } from "@/features/chat/hooks/use-chat";

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

  const thinkingConfig = useThinkingConfig();

  const [selectedApp, setSelectedApp] = useState<AppState | null>(null);
  const { data: apps = [] } = useGetAppsQuery();

  const {
    messages,
    input,
    setInput,
    isLoading,
    sendMessageStreaming,
    focusInput,
    refs: { messagesRef },
  } = useChat({ initialMessages: [] });

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const handleSend = useCallback((): void => {
    if (!input.trim()) return;

    sendMessageStreaming(selectedModel, {
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
  }, [
    input,
    selectedModel,
    sendMessageStreaming,
    toolMode,
    thinkingConfig,
    thinkingEnabled,
    thinkingLevel,
    structuredOutputEnabled,
    structuredOutputSchema,
  ]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 dark:bg-primary-950/50 bg-primary mx-3 -pb-4  rounded-2xl overflow-hidden">
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
          placeholder="Message"
          isChatPage={true}
          selectedApp={selectedApp}
          onSelectedAppChange={setSelectedApp}
        />
      </div>
    </div>
  );
}
