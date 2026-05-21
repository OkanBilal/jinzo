import { useEffect, useRef, useState } from "react";
import { parseIcon } from "@/lib/icon-registry";
import type { Space } from "@/lib/redux/api";

interface SpaceSwitchIndicatorProps {
  activeSpace: Space | undefined;
}

const VISIBLE_MS = 600;

export default function SpaceSwitchIndicator({
  activeSpace,
}: SpaceSwitchIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const prevIdRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const prevId = prevIdRef.current;
    const currentId = activeSpace?.id;
    prevIdRef.current = currentId;

    if (!prevId || !currentId || prevId === currentId) return;

    setVisible(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(false), VISIBLE_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [activeSpace?.id]);

  if (!activeSpace) return null;

  const icon = parseIcon(activeSpace.icon);

  return (
    <div
      aria-hidden
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none transition-all duration-200 ease-out ${
        visible
          ? "opacity-100 scale-100"
          : "opacity-0 scale-90"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-primary-100/90 dark:bg-primary/15 backdrop-blur-md border border-primary-300/40 dark:border-primary/30 shadow-lg">
        {icon.type === "emoji" ? (
          <span className="text-xl leading-none">{icon.value}</span>
        ) : (
          <icon.value className="size-3 text-primary-900 dark:text-primary" />
        )}
        <span className="text-sm font-medium text-primary-950 dark:text-primary whitespace-nowrap">
          {activeSpace.name}
        </span>
      </div>
    </div>
  );
}
