import type { ReactNode } from "react";
import { iconColorClass, parseIcon, type IconComponent } from "@/lib/icon-registry";
import { ProjectFolder } from "@/components/ui/icons";

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
      const tint = iconColorClass(parsed.color);
      return (
        <IconComp
          className={`size-3.5 ${tint || "text-primary-700 dark:text-primary-300"}`}
        />
      );
    }
    if (parsed.type === "emoji") {
      return (
        <span className="text-xs ">{parsed.value as string}</span>
      );
    }
  }
  void projectName;
  return <ProjectFolder className="size-3.5 text-primary-950 dark:text-primary" />;
}
