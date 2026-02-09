import { forwardRef } from "react";
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
      "dark:text-copilot-lightblue text-primary-700 placeholder:text-primary-500 dark:placeholder:text-copilot-lightblue/60",
  },
  claude: {
    input:
      "dark:text-claude-light text-primary-700 placeholder:text-primary-500 dark:placeholder:text-claude-light/60",
  },
};

export const InputForm = forwardRef<HTMLInputElement, InputFormProps>(
  function InputForm(
    { query, onQueryChange, onSubmit, placeholder, variant = "default" },
    ref,
  ) {
    const styles = variantStyles[variant];

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        aria-label="Feed input form"
        className="relative"
      >
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className={`rounded-3xl w-full px-6 py-5 placeholder:text-md outline-none ${styles.input}`}
        />
        <kbd className="absolute cursor-default right-4 top-1/3 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-sans text-primary-400 dark:text-primary-500 ">
          ⌘ P to focus
        </kbd>
      </form>
    );
  },
);
