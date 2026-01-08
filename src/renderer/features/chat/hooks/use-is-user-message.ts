import { useMemo } from "react";

import { ChatMessage } from "../../../features/chat/components/chat-message";

export function useIsUserMessage(message: ChatMessage): boolean {
  return useMemo(() => message.role === "user", [message.role]);
}
