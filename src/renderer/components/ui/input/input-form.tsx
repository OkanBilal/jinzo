import { forwardRef, useCallback, useEffect, useRef } from "react";
import type { InputVariant } from "./send-button";

interface InputFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  variant?: InputVariant;
}

const variantStyles = {
  default: {
    input:
      "dark:text-primary-200 text-primary-700 placeholder:text-primary-500 dark:placeholder:text-primary-600",
  },
  copilot: {
    input:
      "dark:text-copilot-light text-primary-700 placeholder:text-primary-500 dark:placeholder:text-copilot-light/60",
  },
  claude: {
    input:
      "dark:text-claude-light text-primary-700 placeholder:text-primary-500 dark:placeholder:text-claude-light/60",
  },
};

export const InputForm = forwardRef<HTMLTextAreaElement, InputFormProps>(
  function InputForm(
    { query, onQueryChange, onSubmit, placeholder, variant = "default" },
    ref,
  ) {
    const styles = variantStyles[variant];
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.RefObject<HTMLTextAreaElement | null>).current = node;
        }
      },
      [ref],
    );

    const autoResize = useCallback(() => {
      const el = internalRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    useEffect(() => {
      autoResize();
    }, [query, autoResize]);

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        aria-label="Feed input form"
        className="relative"
      >
        <textarea
          ref={setRefs}
          value={query}
          rows={1}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          className={`rounded-3xl w-full pl-6 pr-16 py-4 placeholder:text-[15px] outline-none resize-none overflow-hidden ${styles.input}`}
        />
        <kbd className="absolute cursor-default right-4 top-5 px-1.5 py-0.5 text-xxs font-sans text-primary-400 dark:text-primary-500 ">
          ⌘ P to focus
        </kbd>
      </form>
    );
  },
);
