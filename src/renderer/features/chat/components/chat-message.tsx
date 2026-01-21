import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Clipboard } from "../../../components/ui/icons";
import { useCopyToClipboard } from "../../../hooks/use-copy-to-clipboard";
import { useIsUserMessage } from "../../../features/chat/hooks/use-is-user-message";
import { StreamingText } from "./streaming-text";
import { markdownComponents } from "./markdown-components";

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

          {/* Sources and metadata (assistant only) */}
          {/* {!isUser && message.metadata && (
            <div className="mt-2 space-y-2">
              {Array.isArray(message.metadata.sources) && message.metadata.sources.length > 0 && (
                <div className="rounded-lg border border-primary-200 dark:border-primary-800 bg-white/60 dark:bg-primary-950/60">
                  <div className="px-3 py-2 border-b border-primary-200 dark:border-primary-800 text-xs font-semibold text-primary-700 dark:text-primary-300">
                    Sources
                  </div>
                  <ul className="px-3 py-2 text-sm space-y-1">
                    {message.metadata.sources.map((src, idx) => (
                      <li key={`${src.url}-${idx}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                        <div>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-700 dark:text-primary-300 hover:underline"
                          >
                            {src.title || src.url}
                          </a>
                          {src.source && (
                            <span className="ml-2 text-xs text-primary-500 dark:text-primary-400">({src.source})</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )} */}

          {/* Minimal metadata summary if available */}
          {/* {typeof (message.metadata as any).queryType === "string" && (
                <div className="text-[11px] text-primary-500 dark:text-primary-400">
                  <span className="uppercase tracking-wide">{String((message.metadata as any).queryType)}</span>
                  {typeof (message.metadata as any).usedInContext === "number" && typeof (message.metadata as any).totalRetrieved === "number" && (
                    <span className="ml-2">
                      used {(message.metadata as any).usedInContext}/{(message.metadata as any).totalRetrieved}
                    </span>
                  )}
                </div>
              )}
            </div>
          )} */}

          <div
            className={`absolute top-full ${isUser ? "right-0" : "left-0"} ease-out duration-300 ${
              isHovered
                ? " opacity-100 translate-y-0"
                : "opacity-0 translate-y-1 pointer-events-none"
            }`}
          >
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 active:scale-[0.97]  hover:bg-primary-200/60 dark:hover:bg-primary-900 p-1  rounded-md ease-out duration-150 hover:scale-105  cursor-pointer `}
              aria-label="Copy message to clipboard"
            >
              {isCopied ? (
                <Check className="text-primary-300 w-5.5 h-5.5" />
              ) : (
                <Clipboard className="text-primary-300 w-5.5 h-5.5" />
              )}
            </button>
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
