import { useState, useEffect, useCallback } from "react";

const CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

interface UseEncryptedTextOptions {
  /** Duration to stay in normal state (ms) */
  normalDuration?: number;
  /** Duration for the scramble animation (ms) */
  scrambleDuration?: number;
  /** Speed of character changes during scramble (ms per frame) */
  frameSpeed?: number;
}

export function useEncryptedText(
  text: string,
  enabled: boolean,
  options: UseEncryptedTextOptions = {}
) {
  const {
    normalDuration = 1500,
    scrambleDuration = 1500,
  } = options;

  const [displayText, setDisplayText] = useState(text);
  const [isScrambling, setIsScrambling] = useState(false);

  // Sync displayText when disabled or text changes while disabled
  const [prevText, setPrevText] = useState(text);
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (text !== prevText || enabled !== prevEnabled) {
    setPrevText(text);
    setPrevEnabled(enabled);
    if (!enabled) {
      setDisplayText(text);
    }
  }

  const getRandomChar = useCallback(() => {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }, []);

  const scrambleText = useCallback(
    (original: string, progress: number): string => {
      return original
        .split("")
        .map((char, index) => {
          if (char === " ") return " ";
          // Characters resolve from left to right based on progress
          const charProgress = index / original.length;
          if (progress > charProgress) {
            return char;
          }
          return getRandomChar();
        })
        .join("");
    },
    [getRandomChar]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let animationFrame: number;
    let timeout: NodeJS.Timeout;

    const runAnimation = () => {
      // Phase 1: Normal text display
      setDisplayText(text);
      setIsScrambling(false);

      timeout = setTimeout(() => {
        // Phase 2: Scramble out (text -> random)
        setIsScrambling(true);
        const scrambleOutStart = Date.now();

        const scrambleOut = () => {
          const elapsed = Date.now() - scrambleOutStart;
          const progress = Math.min(elapsed / (scrambleDuration / 2), 1);

          // Progress goes from 1 to 0 (revealing random chars from right to left)
          setDisplayText(scrambleText(text, 1 - progress));

          if (progress < 1) {
            animationFrame = requestAnimationFrame(scrambleOut);
          } else {
            // Phase 3: Fully scrambled pause
            timeout = setTimeout(() => {
              // Phase 4: Scramble in (random -> text)
              const scrambleInStart = Date.now();

              const scrambleIn = () => {
                const elapsed = Date.now() - scrambleInStart;
                const progress = Math.min(elapsed / (scrambleDuration / 2), 1);

                setDisplayText(scrambleText(text, progress));

                if (progress < 1) {
                  animationFrame = requestAnimationFrame(scrambleIn);
                } else {
                  setIsScrambling(false);
                  // Restart the cycle
                  timeout = setTimeout(runAnimation, normalDuration);
                }
              };

              scrambleIn();
            }, 300); // Brief pause when fully scrambled
          }
        };

        scrambleOut();
      }, normalDuration);
    };

    runAnimation();

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeout);
    };
  }, [enabled, text, normalDuration, scrambleDuration, scrambleText]);

  return {
    displayText,
    isScrambling,
  };
}
