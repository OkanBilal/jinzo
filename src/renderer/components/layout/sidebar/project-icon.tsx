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
    if (parsed.type === "icon") {
      const IconComp = parsed.value as IconComponent;
      return (
        <IconComp className="size-3.5 text-primary-700 dark:text-primary-200" />
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
    <div className="size-3.5 rounded-md flex items-center font-mono justify-center text-t font-medium text-primary-700 dark:text-primary-200 border border-primary-700 dark:border-primary-200">
      {initial}
    </div>
  );
}
