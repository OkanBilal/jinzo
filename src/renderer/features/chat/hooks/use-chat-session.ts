import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useGetChatMessagesQuery,
  useGetChatSessionQuery,
} from "@/lib/redux/api";

interface UseChatSessionOptions {
  onMessagesLoaded?: (messages: ReturnType<typeof useGetChatMessagesQuery>["data"]) => void;
}

export function useChatSession(options: UseChatSessionOptions = {}) {
  const params = useParams();
  const navigate = useNavigate();

  const sessionId = params.id ? Number(params.id) : null;
  const isValidSession = sessionId !== null && !isNaN(sessionId);

  const { data: messagesData, isLoading: isLoadingMessages } =
    useGetChatMessagesQuery(sessionId ?? 0, {
      skip: !isValidSession,
      // Refetch when component remounts to sync with DB after navigation
      refetchOnMountOrArgChange: true,
    });

  const { data: sessionData } = useGetChatSessionQuery(sessionId ?? 0, {
    skip: !isValidSession,
    refetchOnMountOrArgChange: true,
  });

  // Redirect if invalid session ID
  useEffect(() => {
    if (!isValidSession) {
      navigate("/", { replace: true });
    }
  }, [isValidSession, navigate]);

  // Notify when messages are loaded
  useEffect(() => {
    if (isValidSession && messagesData && options.onMessagesLoaded) {
      options.onMessagesLoaded(messagesData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValidSession, messagesData, options.onMessagesLoaded]);

  // Get chat title from session data
  const chatTitle = useMemo(() => {
    if (sessionData?.title) {
      return sessionData.title;
    }
    if (messagesData && messagesData.length > 0) {
      const firstUserMsg = messagesData.find((m) => m.role === "user");
      return firstUserMsg ? firstUserMsg.content.slice(0, 60) : "Chat";
    }
    return "Chat";
  }, [sessionData, messagesData]);

  return {
    sessionId,
    isValidSession,
    messagesData,
    sessionData,
    isLoadingMessages,
    chatTitle,
  };
}
