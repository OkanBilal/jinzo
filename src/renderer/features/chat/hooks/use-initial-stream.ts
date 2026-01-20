import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/redux/api";

interface UseInitialStreamOptions {
  sessionId: number | null;
  messagesData: ChatMessage[] | undefined;
  selectedModel: string;
  onTriggerStream: (content: string) => void;
}

export function useInitialStream({
  sessionId,
  messagesData,
  selectedModel,
  onTriggerStream,
}: UseInitialStreamOptions) {
  const initialStreamTriggeredRef = useRef(false);

  // Reset trigger when session changes
  useEffect(() => {
    initialStreamTriggeredRef.current = false;
  }, [sessionId]);

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
    onTriggerStream(lastUserMessage.content);
  }, [messagesData, selectedModel, sessionId, onTriggerStream]);

  return {
    wasTriggered: initialStreamTriggeredRef.current,
  };
}
