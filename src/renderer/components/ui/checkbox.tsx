import * as React from "react";
import { cn } from "../../lib/cn";
import { Check } from "./icons";

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
          "w-4 h-4 min-w-4 min-h-4 rounded-md border transition-colors duration-200 flex items-center justify-center",
          checked
            ? "bg-primary-800 dark:bg-primary-200 border-primary-600 dark:border-primary-500"
            : "bg-primary dark:bg-primary-800 border-primary-300 dark:border-primary-600/60",
          !disabled && "hover:border-primary-500 dark:hover:border-primary-700",
        )}
      >
        {checked && <Check className="w-3 h-3 text-primary dark:text-primary-900" />}
      </div>
    </label>
  );
}
