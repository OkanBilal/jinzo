import { LazyMotion, m, domAnimation } from "motion/react";

interface PromptSuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function PromptSuggestionChips({
  suggestions,
  onSelect,
  disabled,
}: PromptSuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  const suggestion = suggestions[suggestions.length - 1];

  return (
    <LazyMotion features={domAnimation}>
      <div className="w-full py-2 flex flex-col items-end gap-1">
        <m.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          onClick={() => !disabled && onSelect(suggestion)}
          disabled={disabled}
          className="shooting-star-border group rounded-2xl max-w-[80%]
            cursor-pointer
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="spark" />
          <span className="spark-backdrop rounded-2xl" />
          <span className="relative z-10 flex items-center gap-2 px-4 py-2.5 text-sm
            text-primary-950 dark:text-primary-50">
            <span className="truncate max-w-100">{suggestion}</span>
          </span>
        </m.button>
        <m.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-xxs  tracking-tight text-primary-500 dark:text-primary-600 -mt-2 mr-1"
        >
        suggestion
        </m.span>
      </div>

    </LazyMotion>
  );
}
