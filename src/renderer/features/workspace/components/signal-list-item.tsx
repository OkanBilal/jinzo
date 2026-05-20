import { Plus } from "@/components/ui/icons";
import { ProviderIcon } from "./provider-icon";
import type { SignalWithEntity } from "@/lib/redux/api";
import { Button } from "@/components/ui";

interface SignalListItemProps {
  signal: SignalWithEntity;
  isActive: boolean;
  onClick: () => void;
  onAddToContext?: () => void;
}

const levelLabels: Record<string, string> = {
  fatal: "fatal",
  critical: "critical",
  error: "error",
  warning: "warning",
  info: "info",
};

export function SignalListItem({
  signal,
  isActive,
  onClick,
  onAddToContext,
}: SignalListItemProps) {
  const { signal: sig, entity } = signal;
  const title = entity.title || "Untitled signal";

  const handleAddToContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToContext?.();
  };

  const handleClick = (_e: React.MouseEvent) => {
    onClick();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
      className={`w-full text-left px-1 py-1.5 rounded-xl cursor-pointer transition-all duration-200 ease-out flex items-center gap-2 group ${
        isActive
          ? "bg-primary/80 dark:bg-primary/5"
          : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
      }`}
    >
      {/* Source icon - left, vertically centered */}
      <span className="shrink-0 inline-flex items-center justify-center px-1 text-primary">
        <ProviderIcon
          provider={sig.source}
          className="w-5 h-5 text-primary-800 dark:text-primary-300"
        />
      </span>

      {/* Content - title on top, labels below */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-s text-primary-900 dark:text-primary-100 font-medium truncate">
          {title}
        </span>

        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className="inline-block capitalize px-1.5 py-0 text-xxs font-medium rounded-full bg-primary-200 dark:bg-primary-600 text-primary-600 dark:text-primary-100">
            {levelLabels[sig.level] ?? sig.level}
          </span>
          {sig.eventCount > 1 && (
            <span className="inline-block px-1.5 py-0 text-xxs font-medium rounded-full bg-primary-200 dark:bg-primary-400 text-primary-600 dark:text-primary-100 tabular-nums">
              {sig.eventCount}x
            </span>
          )}
        </div>
      </div>

      {/* Add to context button - right, vertically centered */}
      {onAddToContext && (
        <Button
          onClick={handleAddToContext}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/20 dark:hover:bg-primary/10 transition-all"
          title="Add to context"
        >
          <Plus className="w-3 h-3 text-primary-500 dark:text-primary-400" />
        </Button>
      )}
    </div>
  );
}
