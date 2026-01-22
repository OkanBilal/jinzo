import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/redux/api";

interface UseInitialStreamOptions {
  sessionId: number | null;
  messagesData: ChatMessage[] | undefined;
  selectedModel: string;
  onTriggerStream: (content: string, messageId: number) => void;
}

// Module-level tracking to persist across component remounts
// Tracks user message IDs that have already had generation triggered
const triggeredMessageIds = new Set<number>();

// Clear triggered message IDs for a session (call when session is deleted)
export function clearTriggeredMessageId(messageId: number) {
  triggeredMessageIds.delete(messageId);
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

    // Check if we've already triggered generation for this specific message ID
    // This persists across component remounts and prevents duplicate generation
    if (triggeredMessageIds.has(lastUserMessage.id)) {
      // Mark as triggered for this component instance too
      setTriggeredSessionId(sessionId);
      return;
    }

    // Mark this message as having generation triggered (module-level, survives remount)
    triggeredMessageIds.add(lastUserMessage.id);
    setTriggeredSessionId(sessionId);
    onTriggerStream(lastUserMessage.content, lastUserMessage.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesData, selectedModel, sessionId, onTriggerStream]);

  return {
    wasTriggered: triggeredSessionId === sessionId,
  };
}
