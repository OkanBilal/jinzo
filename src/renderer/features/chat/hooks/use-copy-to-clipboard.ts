import { useState, useCallback, useRef, useEffect } from "react";

const DEFAULT_COPY_FEEDBACK_DURATION = 1000;

export function useCopyToClipboard(
  feedbackDuration: number = DEFAULT_COPY_FEEDBACK_DURATION
) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          setIsCopied(false);
        }, feedbackDuration);
      } catch (error) {
        console.error("Failed to copy text:", error);
      }
    },
    [feedbackDuration]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isCopied, copy };
}
