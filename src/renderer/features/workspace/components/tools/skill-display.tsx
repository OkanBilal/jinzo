import { Sparkles } from "@/components/ui/icons";

export interface SkillParams {
  skill?: string;
  args?: string;
}

export function SkillDisplay({ params, isCompact = false }: { params: SkillParams; isCompact?: boolean }) {
  const skillName = params.skill || "unknown";

  return (
    <div className="px-2">
      <div className="flex items-center gap-2 py-0.5 text-s font-sans">
        {!isCompact && <Sparkles className="size-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            Skill
          </span>
        )}
        <span className="text-primary-700 dark:text-primary-200 font-medium">
          /{skillName}
        </span>
        {params.args && (
          <span className="text-primary-500 truncate">
            {params.args}
          </span>
        )}
      </div>
    </div>
  );
}
