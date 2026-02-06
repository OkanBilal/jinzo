import { Suspense, useEffect, useState, useCallback } from "react";
import { ChatHeader, ChatMessages } from "@/features/chat/components";
import ChatInput from "@/features/chat/components/input";
import {
  useChat,
  useChatConfig,
  useChatSession,
  useInitialStream,
  useTitleGeneration,
} from "@/features/chat/hooks";
import ChatLoadingFallback from "@/features/chat/components/chat-fallback";

function ChatContent() {
  const [triggeredSessionId, setTriggeredSessionId] = useState<number | null>(
    null,
  );

  const { selectedModel, getRequestOptions } = useChatConfig();

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
          userMessageId: messageId,
          ...getRequestOptions(),
        },
      });
    },
    [sessionId, selectedModel, sendTextStreaming, getRequestOptions],
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

    sendTextStreaming(input, selectedModel, sessionId, {
      requestOptions: getRequestOptions(),
    });
    setInput("");
  }, [
    input,
    sessionId,
    selectedModel,
    sendTextStreaming,
    getRequestOptions,
    setInput,
  ]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="shrink-0 pt-6 max-w-200 mx-auto w-full">
        <ChatHeader title={chatTitle} />
      </div>
      <div className="flex-1 overflow-hidden mx-auto w-full max-w-200 relative">
        <ChatMessages
          ref={messagesRef}
          messages={messages}
          isLoading={isLoading}
        />
        {/* Bottom fade overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-primary dark:from-primary-950 to-transparent pointer-events-none" />
      </div>
      <div className="shrink-0 max-w-200 mx-auto mb-4 w-full">
        <ChatInput
          query={input}
          onQueryChange={setInput}
          onSubmit={handleSend}
          loading={isLoading || isLoadingMessages}
          placeholder="Message"
        />
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
