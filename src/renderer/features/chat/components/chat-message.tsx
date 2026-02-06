import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Clipboard } from "../../../components/ui/icons";
import { useCopyToClipboard } from "../../../hooks/use-copy-to-clipboard";
import { useIsUserMessage } from "../../../features/chat/hooks/use-is-user-message";
import { StreamingText } from "./streaming-text";
import { markdownComponents } from "./markdown-components";
import { Button } from "@/components/ui/button";

export const ChatMessageComponent = memo(
  ({ message, showTimestamp = false }: ChatMessageProps) => {
    const isUser = useIsUserMessage(message);
    const [isHovered, setIsHovered] = useState(false);
    const { isCopied, copy } = useCopyToClipboard();

    const handleCopy = () => {
      copy(message.text);
    };

    const formatMessageTime = (timestamp?: Date): string => {
      if (!timestamp) return "";

      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(timestamp);
    };

    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className="max-w-full space-y-1 relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={` rounded-2xl transition-all duration-200 ${
              isUser
                ? "px-4 py-3 dark:bg-primary-900 text-primary-950 bg-primary-50 dark:text-primary-50 whitespace-pre-wrap wrap-break-word"
                : "px-0 py-3 text-inherit"
            }`}
          >
            {isUser ? (
              <p className="text-sm">{message.text}</p>
            ) : (
              <>
                {(message.metadata as any)?.streaming ? (
                  <StreamingText
                    text={message.text}
                    isStreaming={true}
                    revealSpeed={4}
                  />
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {message.text}
                    </ReactMarkdown>
                  </div>
                )}
              </>
            )}
          </div>

          <div
            className={`absolute top-full ${isUser ? "right-0" : "left-0"} ease-out duration-300 ${
              isHovered
                ? " opacity-100 translate-y-0"
                : "opacity-0 translate-y-1 pointer-events-none"
            }`}
          >
            <Button
              onClick={handleCopy}
              className="flex items-center gap-1 active:scale-99 hover:bg-primary-200/60 dark:hover:bg-primary-900 p-1.5 rounded-md ease-out duration-150 hover:scale-101 cursor-pointer"
              aria-label="Copy message to clipboard"
            >
              {isCopied ? (
                <Check className="text-primary-300 w-5 h-5 animate-[scaleIn_0.15s_ease-out]" />
              ) : (
                <Clipboard className="text-primary-300 w-5 h-5" />
              )}
            </Button>
          </div>

          {showTimestamp && message.timestamp && (
            <div
              className={`text-xs text-primary-400 px-2 ${isUser ? "text-right" : "text-left"}`}
            >
              {formatMessageTime(message.timestamp)}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessageComponent.displayName = "ChatMessage";

interface ChatMessageProps {
  message: ChatMessage;
  showTimestamp?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp?: Date;
  metadata?: {
    sources?: Array<{
      title: string;
      url: string;
      source: string;
    }>;
    [key: string]: unknown;
  };
}
