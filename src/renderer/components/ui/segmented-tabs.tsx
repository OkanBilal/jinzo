import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

export interface SegmentedTabOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<SegmentedTabOption<T>>;
  /**
   * Visual treatment:
   *  - `pill`     (default) — container bg + sliding indicator (Dashboard, Plugins)
   *  - `plain`    — no container, no indicator, just active highlight (Connections)
   *  - `bordered` — inline-flex with shared border, no indicator (auto-sync interval)
   */
  variant?: "pill" | "plain" | "bordered";
  /** When true, all tabs render disabled (used by sections behind a toggle). */
  disabled?: boolean;
  className?: string;
}

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  variant = "pill",
  disabled = false,
  className = "",
}: SegmentedTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  // Bordered swaps backgrounds in place; pill and plain slide an indicator.
  const hasIndicator = variant !== "bordered";

  const updateIndicator = useCallback(() => {
    if (!hasIndicator) return;
    const container = containerRef.current;
    const activeTab = tabRefs.current.get(value);
    if (!container || !activeTab) return;
    const containerRect = container.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    setIndicator({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, [hasIndicator, value]);

  useLayoutEffect(() => {
    updateIndicator();
    if (!hasIndicator) return;
    const ro = new ResizeObserver(() => updateIndicator());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", updateIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator, hasIndicator]);

  const containerClass =
    variant === "pill"
      ? "relative flex rounded-full glass-surface p-0.5"
      : variant === "bordered"
        ? "inline-flex rounded-xl border border-primary-200/50 dark:border-primary-800/40 overflow-hidden"
        : "relative flex gap-1";

  const tabClass = (isActive: boolean) => {
    if (variant === "pill") {
      return cn(
        "relative z-(--z-base) flex-1 text-center px-3 py-1 text-xs font-medium rounded-[10px] whitespace-nowrap transition-colors duration-300",
        "focus-visible:ring-0 focus-visible:ring-offset-0",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        isActive
          ? "text-primary-900 dark:text-primary-100"
          : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300",
      );
    }
    if (variant === "bordered") {
      return cn(
        "px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-0 focus-visible:ring-offset-0",
        disabled
          ? "bg-primary-100 dark:bg-primary-900 text-primary-400 dark:text-primary-600 cursor-not-allowed opacity-50"
          : isActive
            ? "bg-primary-900 dark:bg-primary-200 text-primary dark:text-primary-900 cursor-pointer"
            : "bg-primary dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 cursor-pointer",
      );
    }
    // plain — the sliding indicator owns the active background.
    return cn(
      "relative z-(--z-base) px-2.5 py-1 text-xs rounded-xl whitespace-nowrap transition-colors duration-300",
      "focus-visible:ring-0 focus-visible:ring-offset-0",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      isActive
        ? "text-primary-900 dark:text-primary-100"
        : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-100/50 dark:hover:bg-primary-800/30",
    );
  };

  return (
    <div ref={containerRef} className={cn(containerClass, className)}>
      {hasIndicator && (
        <div
          aria-hidden
          className={cn(
            "absolute transition-all duration-300 ease-in-out",
            variant === "pill"
              ? "top-0.75 bg-primary dark:bg-primary/10 glass-button rounded-full"
              : "inset-y-0 bg-primary-200/80 dark:bg-primary-800/60 glass-button rounded-xl",
          )}
          style={{
            left: indicator.left,
            width: indicator.width,
            ...(variant === "pill" ? { height: "calc(100% - 5.5px)" } : {}),
          }}
        />
      )}
      {options.map((opt) => (
        <Button
          key={opt.value}
          ref={(el) => {
            if (el) tabRefs.current.set(opt.value, el);
          }}
          type="button"
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          data-active={value === opt.value ? "true" : undefined}
          className={tabClass(value === opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
