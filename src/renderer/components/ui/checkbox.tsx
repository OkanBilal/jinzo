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
          "w-4 h-4 min-w-4 min-h-4 rounded-md glass-outline transition-colors duration-200 flex items-center justify-center",
          checked
            ? "bg-primary-800 dark:bg-primary-200 glass-fill-primary dark:glass-fill-primary-800"
            : "bg-primary dark:bg-primary-800 glass-fill-primary dark:glass-fill-primary-800",
          !disabled && "hover:glass-fill-primary-800 dark:hover:glass-fill-primary-200",
        )}
      >
        {checked && <Check className="w-3 h-3 text-primary dark:text-primary-900" />}
      </div>
    </label>
  );
}
