import type { ReactNode } from "react";
import { Sparkles } from "@/components/ui/icons";

export interface SkillParams {
  skill?: string;
  args?: string;
}

export function SkillDisplay({
  params,
  isCompact = false,
  icon,
}: {
  params: SkillParams;
  isCompact?: boolean;
  /** Plugin-derived icon override; falls back to the Sparkles glyph when absent. */
  icon?: ReactNode;
}) {
  const skillName = params.skill || "unknown";

  return (
    <div className="">
      <div className="flex items-center gap-1 py-1  text-s font-sans">
        {!isCompact &&
          (icon ?? (
            <Sparkles className="size-4 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />
          ))}
        {!isCompact && (
          <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
            Skill
          </span>
        )}
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
          /{skillName}
        </span>
        {params.args && (
          <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
            {params.args}
          </span>
        )}
      </div>
    </div>
  );
}
