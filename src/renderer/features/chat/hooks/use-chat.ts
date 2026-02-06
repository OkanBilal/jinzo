import { useCallback, useEffect, useRef, useState } from "react";

export interface UIChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp?: Date;
  model?: string;
  metadata?: {
    sources?: Array<{
      title: string;
      url: string;
      source: string;
    }>;
    [key: string]: unknown;
  };
}

export interface UseChatOptions {
  initialMessages?: UIChatMessage[];
  sessionId?: number | null;
  autoScroll?: boolean;
  maxMessages?: number;
  mcpMode?: boolean;
}

export interface UseChatReturn {
  messages: UIChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  sendMessageStreaming: (
    model?: string,
    options?: StreamSendOptions,
  ) => Promise<void>; // sends current input
  sendTextStreaming: (
    // sends provided text
    text: string,
    model?: string,
    sessionId?: number | null,
    options?: StreamSendOptions,
  ) => Promise<void>;
  addMessage: (
    message: Omit<UIChatMessage, "id" | "timestamp">,
  ) => UIChatMessage;
  replaceMessages: (messages: UIChatMessage[]) => void;
  clearMessages: () => void;
  focusInput: () => void;
  refs: {
    messagesRef: React.RefObject<HTMLUListElement | null>;
    inputRef: React.RefObject<HTMLInputElement | null>;
  };
}

interface StreamSendOptions {
  skipUserMessage?: boolean;
  requestOptions?: Record<string, unknown>;
}

const DEFAULT_OPTIONS: Required<Omit<UseChatOptions, "sessionId">> = {
  initialMessages: [],
  autoScroll: true,
  maxMessages: 100,
  mcpMode: false,
};

function createMessage(
  message: Omit<UIChatMessage, "id" | "timestamp">,
): UIChatMessage {
  return {
    ...message,
    id: crypto.randomUUID(),
    timestamp: new Date(),
  };
}

function validateInput(text: string): string | null {
  const cleaned = text.trim();
  if (!cleaned) {
    console.warn("Attempted to send empty message");
    return null;
  }
  return cleaned;
}

function trimMessages(
  messages: UIChatMessage[],
  maxMessages: number,
): UIChatMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }
  return messages.slice(messages.length - maxMessages);
}

function scrollToBottom(
  ref: React.RefObject<HTMLUListElement | null>,
  smooth = true,
) {
  if (ref.current) {
    ref.current.scrollTo({
      top: ref.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }
}

export const useChat = (options: UseChatOptions = {}): UseChatReturn => {
  const {
    initialMessages = DEFAULT_OPTIONS.initialMessages,
    autoScroll = DEFAULT_OPTIONS.autoScroll,
    maxMessages = DEFAULT_OPTIONS.maxMessages,
    sessionId: initialSessionId,
  } = options;

  const [messages, setMessages] = useState<UIChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState<number | null | undefined>(initialSessionId);
  const rafRef = useRef<number | null>(null);
  const pendingTextRef = useRef<string>("");

  const messagesRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      scrollToBottom(messagesRef);
    }
  }, [messages, autoScroll]);

  const addMessage = useCallback(
    (message: Omit<UIChatMessage, "id" | "timestamp">): UIChatMessage => {
      const newMessage = createMessage(message);

      setMessages((prev) => {
        const updated = [...prev, newMessage];
        return trimMessages(updated, maxMessages);
      });

      return newMessage;
    },
    [maxMessages],
  );

  const updateMessageText = useCallback((id: string, text: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m)));
  }, []);

  const sendTextStreaming = useCallback(
    async (
      text: string,
      model?: string,
      sid?: number | null,
      streamOptions?: StreamSendOptions,
    ): Promise<void> => {
      const cleaned = validateInput(text);
      if (!cleaned || isLoading) return;

      if (!streamOptions?.skipUserMessage) {
        addMessage({ role: "user", text: cleaned, model });
      }
      setIsLoading(true);

      const assistantMsg = addMessage({
        role: "assistant",
        text: "",
        model,
        metadata: { streaming: true },
      });

      let fullText = "";
      let unsubscribeChunk: (() => void) | null = null;
      let unsubscribeFinal: (() => void) | null = null;
      let unsubscribeError: (() => void) | null = null;

      try {
        const targetSessionId = sid ?? sessionId;

        // Set up IPC listeners for streaming
        unsubscribeChunk = window.api.chat.onStreamChunk((data) => {
          if (data.sessionId === targetSessionId) {
            fullText += data.content;
            pendingTextRef.current = fullText;
            if (rafRef.current == null) {
              rafRef.current = window.requestAnimationFrame(() => {
                updateMessageText(assistantMsg.id, pendingTextRef.current);
                rafRef.current = null;
              });
            }
          }
        });

        unsubscribeFinal = window.api.chat.onStreamFinal((data) => {
          if (data.sessionId === targetSessionId) {
            fullText = data.answer || fullText;
            if (rafRef.current != null) {
              window.cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            updateMessageText(assistantMsg.id, fullText);
            const mappedSources = Array.isArray(data.sources)
              ? data.sources.map((s: any) => ({
                  title: s.title,
                  url: s.url,
                  source: s.source,
                }))
              : [];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      metadata: {
                        ...data.metadata,
                        sources: mappedSources,
                        streaming: false,
                      },
                    }
                  : m,
              ),
            );
            setIsLoading(false);

            // Clean up listeners
            unsubscribeChunk?.();
            unsubscribeFinal?.();
            unsubscribeError?.();
          }
        });

        unsubscribeError = window.api.chat.onStreamError((data) => {
          if (data.sessionId === targetSessionId) {
            console.error("Chat stream error:", data.error);
            if (rafRef.current != null) {
              window.cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            updateMessageText(
              assistantMsg.id,
              "Sorry, I encountered an error streaming the response. Please try again.",
            );
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      metadata: { ...(m.metadata || {}), streaming: false },
                    }
                  : m,
              ),
            );
            setIsLoading(false);
            // Clean up listeners
            unsubscribeChunk?.();
            unsubscribeFinal?.();
            unsubscribeError?.();
          }
        });

        const payload: Record<string, unknown> = {
          question: cleaned,
          model,
          sessionId: targetSessionId,
        };

        if (streamOptions?.requestOptions) {
          payload.options = streamOptions.requestOptions;
        }

        // Send the chat request via IPC
        const result = await window.api.chat.send(payload);

        if (!result.success) {
          throw new Error(result.error || "Failed to send chat message");
        }
      } catch (error) {
        console.error("Failed to stream message:", error);
        if (rafRef.current != null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        updateMessageText(
          assistantMsg.id,
          "Sorry, I encountered an error streaming the response. Please try again.",
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, metadata: { ...(m.metadata || {}), streaming: false } }
              : m,
          ),
        );
        setIsLoading(false);
        // Clean up listeners
        unsubscribeChunk?.();
        unsubscribeFinal?.();
        unsubscribeError?.();
      }
    },
    [isLoading, addMessage, sessionId, updateMessageText],
  );

  const sendMessageStreaming = useCallback(
    async (model?: string, options?: StreamSendOptions): Promise<void> => {
      const text = validateInput(input);
      if (!text || isLoading) return;
      setInput("");
      await sendTextStreaming(text, model, sessionId ?? null, options);
    },
    [input, isLoading, sendTextStreaming, sessionId],
  );

  const replaceMessages = useCallback(
    (newMessages: UIChatMessage[]) => {
      setMessages(trimMessages(newMessages, maxMessages));
    },
    [maxMessages],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    sendMessageStreaming,
    sendTextStreaming,
    addMessage,
    replaceMessages,
    clearMessages,
    focusInput,
    refs: {
      messagesRef,
      inputRef,
    },
  };
};
