import { useState, useRef } from "react";
import { Caption } from "@/components/ui/text";

interface StopSequenceInputProps {
  sequences: string[];
  onChange: (sequences: string[]) => void;
}

export function StopSequenceInput({
  sequences,
  onChange,
}: StopSequenceInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addSequence = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || sequences.includes(trimmed)) return;
    onChange([...sequences, trimmed]);
    setInputValue("");
  };

  const removeSequence = (index: number) => {
    onChange(sequences.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSequence();
    } else if (
      e.key === "Backspace" &&
      inputValue === "" &&
      sequences.length > 0
    ) {
      removeSequence(sequences.length - 1);
    }
  };

  return (
    <div className="space-y-2">
      <div
        className="
          w-full px-2.5 py-2
          min-w-50 rounded-xl
          bg-primary-950/2 dark:bg-primary/4
          border border-primary-950/10 dark:border-primary/10
          text-sm
          flex flex-wrap items-center gap-1.5
          cursor-text
          transition-all
          shadow-[inset_0_0.5px_0_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]
          focus-within:border-primary-950/20 dark:focus-within:border-primary/20
        "
        onClick={() => inputRef.current?.focus()}
      >
        {sequences.map((seq, index) => (
          <span
            key={index}
            className="
              inline-flex items-center gap-1
              px-2 py-0.5 rounded-lg
              bg-primary-950/8 dark:bg-primary/10
              text-xs font-medium
              text-primary-800 dark:text-primary-200
            "
          >
            <span className="max-w-32 truncate font-mono">{seq}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeSequence(index);
              }}
              className="
                ml-0.5 rounded-full
                text-primary-500 hover:text-primary-900
                dark:text-primary-400 dark:hover:text-primary-100
                transition-colors
              "
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addSequence();
          }}
          placeholder={
            sequences.length === 0 ? "Type and press Enter..." : ""
          }
          className="
            flex-1 min-w-20 bg-transparent
            text-sm text-primary-900 dark:text-primary-200
            placeholder:text-primary-600 dark:placeholder:text-primary-300
            outline-none border-none p-0
          "
        />
      </div>
      <Caption className="text-primary-700! dark:text-primary-200! text-xs">
        Sequences where the model will stop generating.
      </Caption>
    </div>
  );
}
