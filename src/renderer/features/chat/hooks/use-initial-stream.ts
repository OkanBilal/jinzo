import { useEffect, useState } from "react";
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
  const [triggeredSessionId, setTriggeredSessionId] = useState<number | null>(null);

  // Trigger initial streaming response for new chats
  useEffect(() => {
    if (
      !sessionId ||
      !messagesData ||
      messagesData.length === 0 ||
      triggeredSessionId === sessionId
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

    setTriggeredSessionId(sessionId);
    onTriggerStream(lastUserMessage.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesData, selectedModel, sessionId, onTriggerStream]);

  return {
    wasTriggered: triggeredSessionId === sessionId,
  };
}
