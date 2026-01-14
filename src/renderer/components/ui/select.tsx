import { ReactNode, useRef, useState } from "react";
import { useClickOutside } from "@/features/chat/hooks/use-click-outside";

interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SelectProps<T extends string = string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}

export default function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Select an option",
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => {
    if (isOpen) setIsOpen(false);
  });

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-3 py-2.5 
          bg-primary-950/2 dark:bg-primary/4 
          border border-primary-950/10 dark:border-primary/10
          text-primary-800 dark:text-primary-200 
          text-sm focus:outline-none cursor-pointer 
          flex items-center justify-between 
          transition-all
          shadow-[inset_0_0.5px_0_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]
          ${
            isOpen
              ? "rounded-t-xl shadow-lg"
              : "rounded-xl hover:bg-primary-950/4 dark:hover:bg-primary/6"
          }
        `}
      >
        <div className="flex items-center gap-2">
          {selectedOption?.icon}
          <span
            className={
              selectedOption ? "" : "text-primary-500 dark:text-primary-400"
            }
          >
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Options List - Absolute positioned */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 z-50 
            bg-primary/98 dark:bg-primary-900/98
            border border-t-0 border-primary-950/10 dark:border-primary/10 
            rounded-b-xl shadow-lg overflow-hidden
            animate-slideDown"
        >
          <div className="max-h-60 overflow-auto noscrollbar">
            {options.map((option, index) => (
              <button
                type="button"
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  animation: `slideIn 0.20s ease-out ${index * 0.025}s both`,
                }}
                className={`
                  w-full cursor-pointer text-left 
                  transition-colors px-3 py-2.5 
                  text-sm flex items-center gap-2
                  ${
                    value === option.value
                      ? "bg-primary-950/5 dark:bg-primary/8 text-primary-900 dark:text-primary-100 font-medium"
                      : "hover:bg-primary-950/3 dark:hover:bg-primary/5 text-primary-700 dark:text-primary-200"
                  }
                `}
              >
                {option.icon}
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
    </div>
  );
}
