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
          "relative inline-flex h-6 w-11 items-center rounded-full transition-all shadow-(--shadow-inset-toggle) dark:shadow-(--shadow-inset-toggle-dark)",
          disabled && "opacity-40 cursor-not-allowed",
          enabled
            ? "bg-primary-950/50 dark:bg-primary/50"
            : "bg-primary-950/10 dark:bg-primary/10",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-primary shadow-sm transition-transform",
            enabled ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </Button>
    </div>
  );
}
