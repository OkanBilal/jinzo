import * as React from "react";
import { cn } from "../../lib/cn";

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Checkbox({
  checked = false,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Toggle",
}: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled && onChange) {
      onChange(e.target.checked);
    }
  };

  return (
    <label
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      <div
        className={cn(
          "w-5 h-5 min-w-5 min-h-5 rounded-md border transition-colors duration-200 flex items-center justify-center",
          checked
            ? "bg-primary-800 dark:bg-primary-200 border-primary-600 dark:border-primary-500"
            : "bg-primary dark:bg-primary-950 border-primary-300 dark:border-primary-800/60",
          !disabled && "hover:border-primary-500 dark:hover:border-primary-700",
        )}
      >
        <svg
          className={cn(
            "w-3.5 h-3.5 text-primary dark:text-primary-900 transition-opacity duration-200",
            checked ? "opacity-100" : "opacity-0",
          )}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13.5 4.5L6 12L2.5 8.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </label>
  );
}
