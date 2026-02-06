import { forwardRef, useEffect, useRef } from "react";
import { ChatMessage, ChatMessageComponent } from "./chat-message";

const ChatMessages = forwardRef<HTMLUListElement, ChatMessagesProps>(
  ({ messages }, ref) => {
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
        className="w-full h-full overflow-y-auto  space-y-8 pb-12 noscrollbar"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((message) => (
          <li key={message.id} className="max-w-200 mx-auto">
            <ChatMessageComponent message={message} />
          </li>
        ))}
      </ul>
    );
  },
);

ChatMessages.displayName = "ChatMessages";

export { ChatMessages };

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}
