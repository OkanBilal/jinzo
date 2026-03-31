import type { ReactNode } from "react";
import { parseIcon, type IconComponent } from "@/lib/icon-registry";

export function ProjectIcon({
  icon,
  projectName,
}: {
  icon: string | null;
  projectName: string;
}): ReactNode {
  if (icon) {
    const parsed = parseIcon(icon);
    if (
      parsed.type === "icon" ||
      parsed.type === "copilot-animate" ||
      parsed.type === "claude-animate"
    ) {
      const IconComp = parsed.value as IconComponent;
      return (
        <IconComp className="size-3.5 text-primary-900 dark:text-primary-300" />
      );
    }
    if (parsed.type === "emoji") {
      return (
        <span className="text-xs leading-none">{parsed.value as string}</span>
      );
    }
  }
  const initial = (projectName?.[0] ?? "P").toUpperCase();
  return (
    <div className="size-4 rounded-md flex items-center justify-center text-t font-medium text-primary-950 dark:text-primary-200 border border-primary-950/50 dark:border-primary/10">
      {initial}
    </div>
  );
}
