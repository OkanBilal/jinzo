import {
  Suspense,
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChatHeader,
  ChatMessages,
  LoadingIndicator,
} from "../features/chat/components";
import ChatInput from "../features/chat/components/input";
import { AppState } from "../features/chat/components/input/types";
import { useChat } from "../features/chat/hooks/use-chat";
import { useThinkingConfig } from "../features/chat/hooks/use-thinking-config";
import {
  useGetAppsQuery,
  useGetChatMessagesQuery,
  useGetChatSessionQuery,
  useGenerateChatSessionTitleMutation,
} from "../lib/redux/api";
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

  const sessionId = params.id ? Number(params.id) : null;

  const [selectedApp, setSelectedApp] = useState<AppState | null>(null);

  const { data: messagesData, isLoading: isLoadingMessages } =
    useGetChatMessagesQuery(sessionId ?? 0, {
      skip: !sessionId || isNaN(sessionId),
    });

  const { data: sessionData } = useGetChatSessionQuery(sessionId ?? 0, {
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
  const titleGeneratedRef = useRef(false);
  const wasLoadingRef = useRef(false);

  const [generateTitle] = useGenerateChatSessionTitleMutation();

  // Reset initial stream trigger when session changes
  useEffect(() => {
    initialStreamTriggeredRef.current = false;
    titleGeneratedRef.current = false;
  }, [sessionId]);

  // Redirect if invalid session ID
  useEffect(() => {
    if (!sessionId || isNaN(sessionId)) {
      navigate("/", { replace: true });
    }
  }, [sessionId, navigate]);

  // Sync messages from API to local state
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

  // Get chat title from session data
  const chatTitle = useMemo(() => {
    if (sessionData?.title) {
      return sessionData.title;
    }
    // Fallback to first user message if no title
    if (messagesData && messagesData.length > 0) {
      const firstUserMsg = messagesData.find((m) => m.role === "user");
      return firstUserMsg ? firstUserMsg.content.slice(0, 60) : "Chat";
    }
    return "Chat";
  }, [sessionData, messagesData]);

  // Focus input on mount
  useEffect(() => {
    focusInput();
  }, [focusInput]);

  // Trigger initial streaming response for new chats
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

    sendTextStreaming(lastUserMessage.content, selectedModel, sessionId, {
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
    });
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

  // Generate title after first response completes
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      // Loading just finished
      if (
        sessionId &&
        initialStreamTriggeredRef.current &&
        !titleGeneratedRef.current
      ) {
        titleGeneratedRef.current = true;
        generateTitle({ sessionId, model: selectedModel });
      }
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, sessionId, selectedModel, generateTitle]);

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
    <div className={`h-full w-full flex flex-col`}>
      <div className="shrink-0 pt-6 max-w-200 mx-auto w-full">
        <ChatHeader title={chatTitle} />
      </div>
      <div className="flex-1 overflow-hidden  mx-auto w-full max-w-200 ">
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
