import { useRef } from "react";
import { Caption } from "./text";
import DropdownWrapper from "./dropdown-wrapper";
import { useClickOutside } from "../../features/chat/hooks/use-click-outside";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  placeholder?: string;
  showDescription?: boolean;
}

export default function Select({
  value,
  options,
  onChange,
  isOpen,
  onToggle,
  placeholder = "Select option",
  showDescription = false,
}: SelectProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useClickOutside(dropdownRef, () => {
    if (isOpen) onToggle();
  });

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className="w-full px-2.5 py-2 rounded-2xl bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-800/50 text-primary-800 dark:text-primary-200 text-sm focus:outline-none cursor-pointer flex items-center justify-between transition-colors"
      >
        <div className="flex flex-col items-start">
          <span className={showDescription ? "font-medium" : ""}>
            {selectedOption?.label || placeholder}
          </span>
          {showDescription && selectedOption?.description && (
            <Caption className="text-xs text-primary-500 dark:text-primary-400">
              {selectedOption.description}
            </Caption>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${
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

      <DropdownWrapper isOpen={isOpen} minWidth="w-full" usePortal={true} triggerRef={buttonRef} dropdownRef={dropdownRef}>
        <div className="max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => {
                if (option.value !== value) {
                  onChange(option.value);
                }
                onToggle();
              }}
              className={`w-full cursor-pointer text-left transition-colors px-2.5 py-2 first:rounded-t-xl last:rounded-b-xl hover:bg-primary-100 dark:hover:bg-primary-600/20 text-sm ${
                value === option.value
                  ? "bg-primary-200 dark:bg-primary-800/50 text-primary-900 dark:text-primary-100 font-medium"
                  : "hover:bg-primary-100 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-200"
              }`}
            >
              <div
                className={showDescription ? "font-medium text-sm" : "text-sm"}
              >
                {option.label}
              </div>
              {showDescription && option.description && (
                <Caption
                  className={`text-xs  ${
                    value === option.value
                      ? "text-primary-600 dark:text-primary-300"
                      : "text-primary-500 dark:text-primary-400"
                  }`}
                >
                  {option.description}
                </Caption>
              )}
            </button>
          ))}
        </div>
      </DropdownWrapper>
    </div>
  );
}
