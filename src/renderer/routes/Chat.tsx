"use client";

import { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChatHeader,
  ChatMessages,
  LoadingIndicator,
} from "../features/chat/components";
import PromptInput from "../features/chat/components/input";
import { AppState } from "../features/chat/components/input/types";
import { useChat } from "../features/chat/hooks/use-chat";
import { usePageMount } from "../features/chat/hooks/use-page-mount";
import { useThinkingConfig } from "../features/chat/hooks/use-thinking-config";
import { useGetAppsQuery, useGetChatMessagesQuery } from "../lib/redux/api";
import { useAppSelector } from "../lib/redux/hooks";

function ChatContent() {
  const params = useParams();
  const navigate = useNavigate();
  const selectedModel = useAppSelector((state) => state.chat.selectedModel);
  const thinkingEnabled = useAppSelector((state) => state.chat.thinkingEnabled);
  const thinkingLevel = useAppSelector((state) => state.chat.thinkingLevel);
  const toolMode = useAppSelector((state) => state.chat.toolMode);
  const structuredOutputEnabled = useAppSelector(
    (state) => state.chat.structuredOutputEnabled
  );
  const structuredOutputSchema = useAppSelector(
    (state) => state.chat.structuredOutputSchema
  );

  const thinkingConfig = useThinkingConfig();
  console.log("Thinking Config:", thinkingConfig);

  const sessionId = params.id ? Number(params.id) : null;

  const mounted = usePageMount();
  const [chatTitleExplicit, setChatTitleExplicit] = useState<string | null>(
    null
  );
  const [selectedApp, setSelectedApp] = useState<AppState | null>(null);

  const { data: messagesData, isLoading: isLoadingMessages } =
    useGetChatMessagesQuery(sessionId ?? 0, {
      skip: !sessionId || isNaN(sessionId),
    });

  const { data: apps = [] } = useGetAppsQuery();

  const {
    messages,
    input,
    setInput,
    isLoading,
    sendMessageStreaming,
    sendTextStreaming,
    focusInput,
    replaceMessages,
    refs: { messagesRef },
  } = useChat({ initialMessages: [], sessionId });

  const initialStreamTriggeredRef = useRef(false);

  useEffect(() => {
    initialStreamTriggeredRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || isNaN(sessionId)) {
      navigate("/", { replace: true });
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!sessionId || isNaN(sessionId) || !messagesData) {
      return;
    }

    const uiMessages = messagesData.map((m) => ({
      id: String(m.id),
      role: m.role as "user" | "assistant",
      text: m.content,
      timestamp: new Date(m.createdAt),
    }));

    replaceMessages(uiMessages);
  }, [sessionId, messagesData, replaceMessages]);

  useEffect(() => {
    if (chatTitleExplicit || !messagesData || messagesData.length === 0) {
      return;
    }

    const firstUserMsg = messagesData.find((m) => m.role === "user");
    if (firstUserMsg) {
      setTimeout(() => setChatTitleExplicit(firstUserMsg.content), 0);
    }
  }, [chatTitleExplicit, messagesData]);

  const chatTitle = useMemo(() => {
    if (chatTitleExplicit) return chatTitleExplicit;
    if (messagesData && messagesData.length > 0) {
      const firstUserMsg = messagesData.find((m) => m.role === "user");
      return firstUserMsg ? firstUserMsg.content : "Chat";
    }
    return "Chat";
  }, [chatTitleExplicit, messagesData]);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    if (
      !sessionId ||
      !messagesData ||
      messagesData.length === 0 ||
      initialStreamTriggeredRef.current
    ) {
      return;
    }

    const hasAssistantMessage = messagesData.some(
      (message) => message.role === "assistant"
    );

    if (hasAssistantMessage) {
      return;
    }

    const lastUserMessage = [...messagesData]
      .filter((message) => message.role === "user")
      .pop();

    if (!lastUserMessage) {
      return;
    }

    initialStreamTriggeredRef.current = true;

    (async () => {
      await sendTextStreaming(
        lastUserMessage.content,
        selectedModel,
        sessionId,
        {
          skipUserMessage: true,
          requestOptions: {
            skipUserSave: true,
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
        }
      );
    })();
  }, [
    messagesData,
    selectedModel,
    sendTextStreaming,
    sessionId,
    toolMode,
    thinkingEnabled,
    thinkingLevel,
    thinkingConfig,
    structuredOutputEnabled,
    structuredOutputSchema,
  ]);

  const handleSend = (): void => {
    if (!input.trim()) return;
    (async () => {
      await sendMessageStreaming(selectedModel, {
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
    })();
  };

  return (
    <div
      className={`h-screen fade-in w-full flex flex-col transition-all duration-300 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-0"
      }`}
    >
      <div className="shrink-0 px-4 pt-4 max-w-4xl mx-auto w-full">
        <ChatHeader title={chatTitle} />
      </div>
      <div className="flex-1 overflow-hidden px-4 mx-auto w-full">
        <ChatMessages
          ref={messagesRef}
          messages={messages}
          isLoading={isLoading}
        />
      </div>
      <div className="shrink-0 px-4 pb-12 max-w-232.5 mx-auto w-full">
        <PromptInput
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
