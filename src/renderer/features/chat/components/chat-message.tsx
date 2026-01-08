import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Clipboard } from "../../../components/ui/icons";
import { useCopyToClipboard } from "../../../features/chat/hooks/use-copy-to-clipboard";
import { useIsUserMessage } from "../../../features/chat/hooks/use-is-user-message";

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
                : "px-4 py-3 text-inherit"
            }`}
          >
            {isUser ? (
              <p className="text-sm">{message.text}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-xl font-bold mt-4 mb-2 text-primary-900 dark:text-primary-100">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-lg font-semibold mt-3 mb-2 text-primary-900 dark:text-primary-100">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-base font-semibold mt-2 mb-1 text-primary-900 dark:text-primary-100">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 text-sm leading-relaxed text-primary-800 dark:text-primary-200">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc text-sm list-inside mb-2 space-y-1 text-primary-800 dark:text-primary-200">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2 space-y-1 text-primary-800 dark:text-primary-200">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="ml-2 text-primary-800 dark:text-primary-200">
                        {children}
                      </li>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4 rounded-lg border border-primary-300 dark:border-primary-700">
                        <table className="min-w-full border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-primary-100 dark:bg-primary-800">
                        {children}
                      </thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="bg-white dark:bg-primary-950">
                        {children}
                      </tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="border-b border-primary-200 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                        {children}
                      </tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-primary-900 dark:text-primary-100 border-r border-primary-200 dark:border-primary-700 last:border-r-0">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-3 text-sm text-primary-800 dark:text-primary-200 border-r border-primary-200 dark:border-primary-700 last:border-r-0">
                        {children}
                      </td>
                    ),
                    code: ({ className, children }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="px-1.5 py-0.5 rounded bg-primary-200 dark:bg-primary-800 text-primary-900 dark:text-primary-100 text-sm font-mono">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className="block p-3 rounded-lg bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 text-sm font-mono overflow-x-auto">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="my-2 rounded-lg overflow-hidden">
                        {children}
                      </pre>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 underline transition-colors"
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-primary-400 dark:border-primary-600 pl-4 py-1 my-2 italic text-primary-700 dark:text-primary-300">
                        {children}
                      </blockquote>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-primary-900 dark:text-primary-100">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-primary-800 dark:text-primary-200">
                        {children}
                      </em>
                    ),
                    hr: () => (
                      <hr className="my-4 border-primary-300 dark:border-primary-700" />
                    ),
                  }}
                >
                  {message.text}
                </ReactMarkdown>
                {/* {Boolean((message.metadata as any)?.streaming) && (
                  <span className="ml-0.5 opacity-70 animate-pulse">▋</span>
                )} */}
              </div>
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
