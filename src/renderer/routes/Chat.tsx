import { Suspense, useEffect, useState, useCallback } from "react";
import {
  ChatHeader,
  ChatMessages,
  LoadingIndicator,
} from "@/features/chat/components";
import ChatInput from "@/features/chat/components/input";
import { AppState } from "@/features/chat/components/input/types";
import {
  useChat,
  useChatConfig,
  useChatSession,
  useInitialStream,
  useTitleGeneration,
} from "@/features/chat/hooks";
import { useGetAppsQuery } from "@/lib/redux/api";

function ChatContent() {
  const [selectedApp, setSelectedApp] = useState<AppState | null>(null);
  const [triggeredSessionId, setTriggeredSessionId] = useState<number | null>(null);

  const { selectedModel, getRequestOptions } = useChatConfig();
  const { data: apps = [] } = useGetAppsQuery();

  const {
    messages,
    input,
    setInput,
    isLoading,
    //sendMessageStreaming,
    sendTextStreaming,
    focusInput,
    replaceMessages,
    refs: { messagesRef },
  } = useChat({ initialMessages: [] });

  const {
    sessionId,
    isValidSession,
    messagesData,
    isLoadingMessages,
    chatTitle,
  } = useChatSession();

  // Sync messages from API to local state
  useEffect(() => {
    if (!isValidSession || !messagesData) return;

    const uiMessages = messagesData.map((m) => ({
      id: String(m.id),
      role: m.role as "user" | "assistant",
      text: m.content,
      timestamp: new Date(m.createdAt),
    }));

    replaceMessages(uiMessages);
  }, [isValidSession, messagesData, replaceMessages]);

  // Focus input on mount
  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const handleInitialStream = useCallback(
    (content: string, messageId: number) => {
      if (!sessionId) return;
      setTriggeredSessionId(sessionId);

      sendTextStreaming(content, selectedModel, sessionId, {
        skipUserMessage: true,
        requestOptions: {
          skipUserSave: true,
          userMessageId: messageId, // Track which user message triggered this generation
          ...getRequestOptions(),
        },
      });
    },
    [sessionId, selectedModel, sendTextStreaming, getRequestOptions]
  );

  useInitialStream({
    sessionId,
    messagesData,
    selectedModel,
    onTriggerStream: handleInitialStream,
  });

  useTitleGeneration({
    sessionId,
    selectedModel,
    isLoading,
    shouldGenerate: triggeredSessionId === sessionId,
  });

  const handleSend = useCallback((): void => {
    if (!input.trim() || !sessionId) return;

    // Use sendTextStreaming with the sessionId from URL to ensure messages are persisted
    sendTextStreaming(input, selectedModel, sessionId, {
      requestOptions: getRequestOptions(),
    });
    setInput("");
  }, [input, sessionId, selectedModel, sendTextStreaming, getRequestOptions, setInput]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="shrink-0 pt-6 max-w-200 mx-auto w-full">
        <ChatHeader title={chatTitle} />
      </div>
      <div className="flex-1 overflow-hidden mx-auto w-full max-w-200">
        <ChatMessages
          ref={messagesRef}
          messages={messages}
          isLoading={isLoading}
        />
      </div>
      <div className="shrink-0 pb-8 max-w-200 mx-auto w-full">
        <ChatInput
          apps={apps}
          query={input}
          onQueryChange={setInput}
          onSubmit={handleSend}
          loading={isLoading || isLoadingMessages}
          placeholder="Message"
          isChatPage={true}
          selectedApp={selectedApp}
          onSelectedAppChange={setSelectedApp}
        />
      </div>
    </div>
  );
}

function ChatLoadingFallback() {
  return (
    <div className="min-h-screen w-full px-4 flex items-center justify-center">
      <div className="text-center">
        <LoadingIndicator />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoadingFallback />}>
      <ChatContent />
    </Suspense>
  );
}
