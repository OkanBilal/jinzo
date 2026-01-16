import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./markdown-components";

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  /**
   * Characters to reveal per frame (higher = faster reveal)
   * @default 1
   */
  revealSpeed?: number;
  /**
   * Interval between reveals in milliseconds
   * @default 30
   */
  revealInterval?: number;
}

/**
 * StreamingText - Renders text with a smooth ChatGPT-like reveal animation.
 *
 * Text is revealed progressively with a blur-to-clear effect on newly
 * appearing content. A blinking cursor shows where new text is being added.
 */
export const StreamingText = memo(
  ({
    text,
    isStreaming,
    revealSpeed = 1,
    revealInterval = 30,
  }: StreamingTextProps) => {
    const [displayedLength, setDisplayedLength] = useState(0);
    // Track which portions of text are "fresh" (recently revealed)
    const [freshStart, setFreshStart] = useState(0);
    const targetLengthRef = useRef(text.length);
    const animationRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const stableTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update target length when text changes
    useEffect(() => {
      targetLengthRef.current = text.length;
    }, [text]);

    // Animation loop for smooth reveal
    useEffect(() => {
      if (!isStreaming && displayedLength >= text.length) {
        return undefined;
      }

      const animate = (timestamp: number) => {
        const elapsed = timestamp - lastUpdateRef.current;

        if (elapsed >= revealInterval) {
          lastUpdateRef.current = timestamp;

          setDisplayedLength((current) => {
            const target = targetLengthRef.current;
            if (current >= target) {
              return current;
            }

            const remaining = target - current;
            const catchUpMultiplier = Math.min(Math.ceil(remaining / 50), 5);
            const charsToReveal = revealSpeed * catchUpMultiplier;

            return Math.min(current + charsToReveal, target);
          });
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [isStreaming, text.length, displayedLength, revealSpeed, revealInterval]);

    // Move fresh text to stable after animation completes
    useEffect(() => {
      if (stableTimeoutRef.current) {
        clearTimeout(stableTimeoutRef.current);
      }

      // After 300ms, mark current displayed text as stable
      stableTimeoutRef.current = setTimeout(() => {
        setFreshStart(displayedLength);
      }, 300);

      return () => {
        if (stableTimeoutRef.current) {
          clearTimeout(stableTimeoutRef.current);
        }
      };
    }, [displayedLength]);

    // When streaming stops, reveal any remaining text immediately
    useEffect(() => {
      if (!isStreaming && displayedLength < text.length) {
        const timeout = setTimeout(() => {
          setDisplayedLength(text.length);
        }, 100);
        return () => clearTimeout(timeout);
      }
      return undefined;
    }, [isStreaming, displayedLength, text.length]);

    // Reset when text is cleared
    useEffect(() => {
      if (text.length === 0) {
        setDisplayedLength(0);
        setFreshStart(0);
      }
    }, [text.length]);

    // Split text into stable and fresh portions
    const { stableText, freshText } = useMemo(() => {
      const displayedText = text.slice(0, displayedLength);
      const safeStableEnd = Math.min(freshStart, displayedLength);
      return {
        stableText: displayedText.slice(0, safeStableEnd),
        freshText: displayedText.slice(safeStableEnd),
      };
    }, [text, displayedLength, freshStart]);

    const isRevealing = displayedLength < text.length;

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none relative">
        {/* Stable text - fully visible */}
        {stableText && (
          <span className="streaming-stable">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {stableText}
            </ReactMarkdown>
          </span>
        )}
        {/* Fresh text - blur reveal animation */}
        {freshText && (
          <span className="streaming-fresh animate-blur-reveal">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {freshText}
            </ReactMarkdown>
          </span>
        )}
        {/* Typing cursor */}
        {(isStreaming || isRevealing) && (
          <span className="inline-block w-0.5 h-[1.1em] ml-0.5 bg-primary-600 dark:bg-primary-400 animate-blink align-middle" />
        )}
      </div>
    );
  }
);

StreamingText.displayName = "StreamingText";
