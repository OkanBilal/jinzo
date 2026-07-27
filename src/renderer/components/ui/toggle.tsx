import { cn } from "../../lib/cn";
import { Button } from "./button";

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function Toggle({ enabled, onChange, label, className, disabled }: ToggleProps) {
  return (
    <div className={cn("flex items-center justify-between py-2", className)}>
      {label && (
        <div className="flex flex-col">
          <span className="text-sm text-primary-900 dark:text-primary">
            {label}
          </span>
        </div>
      )}
      <Button
        onClick={() => !disabled && onChange(!enabled)}
        className={cn(
          "relative inline-flex h-5 w-12 items-center  rounded-full transition-all ",
          disabled && "opacity-40 cursor-not-allowed",
          enabled
            ? "bg-success "
            : "glass-toggle",
        )}
      >
        <span
          className={cn(
            "inline-block h-4.5 w-6.5 transform rounded-full bg-primary-100 shadow-sm transition-transform",
            enabled ? "translate-x-5.25" : "translate-x-px",
          )}
        />
      </Button>
    </div>
  );
}
