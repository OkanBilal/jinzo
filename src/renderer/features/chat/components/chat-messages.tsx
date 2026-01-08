import { forwardRef, useEffect, useRef } from "react";
import { LoadingIndicator } from "./loading-indicator";
import { ChatMessage, ChatMessageComponent } from "./chat-message";

const ChatMessages = forwardRef<HTMLUListElement, ChatMessagesProps>(
  ({ messages, isLoading }, ref) => {
    const prevCountRef = useRef<number>(messages.length);
    useEffect(() => {
      const countChanged = messages.length !== prevCountRef.current;
      if (countChanged && ref && "current" in ref && ref.current) {
        ref.current.lastElementChild?.scrollIntoView({ behavior: "smooth" });
      }
      prevCountRef.current = messages.length;
    }, [messages.length, ref]);

    return (
      <ul
        ref={ref}
        className="w-full h-full overflow-y-auto pr-2 space-y-8 pb-12 noscrollbar"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((message) => (
          <li key={message.id} className="max-w-4xl mx-auto">
            <ChatMessageComponent message={message} />
          </li>
        ))}
        {isLoading && (
          <li className="max-w-4xl mx-auto">
            <LoadingIndicator />
          </li>
        )}
      </ul>
    );
  }
);

ChatMessages.displayName = "ChatMessages";

export { ChatMessages };

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}
