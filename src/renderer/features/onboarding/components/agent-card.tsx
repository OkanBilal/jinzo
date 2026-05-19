import { Button } from "@/components/ui";
import { Check, Plus } from "@/components/ui/icons";
import { Codex, CopilotStatic, Cursor } from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/space";
import { cn } from "@/lib/cn";
import type { OnboardingAgentSlug } from "../onboarding-agents";

interface AgentChoice {
  slug: OnboardingAgentSlug;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export const AGENT_CHOICES: AgentChoice[] = [
  { slug: "claude", label: "Claude", Icon: Claude },
  { slug: "copilot", label: "Copilot", Icon: CopilotStatic },
  { slug: "codex", label: "Codex", Icon: Codex },
  { slug: "cursor", label: "Cursor", Icon: Cursor },
];

export function AgentCard({
  label,
  Icon,
  isSelected,
  onClick,
  disabled,
}: {
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col items-stretch overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer flex-1 min-w-0",
        isSelected
          ? "border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary"
          : "border-primary-200 dark:border-primary-800 text-primary-500 dark:text-primary-400 opacity-80 hover:opacity-100",
        disabled && "opacity-60 cursor-not-allowed",
      )}
      aria-pressed={isSelected}
    >
      <div className="flex flex-row items-center justify-center gap-1 px-4 min-w-24 py-2">
        <Icon className="size-3.5 shrink-0" />
        <span className="text-xs font-medium leading-tight truncate">{label}</span>
      </div>
      <div
        className={cn(
          "flex items-center justify-center h-6 border-t transition-colors",
          isSelected
            ? "border-primary-200 dark:border-primary-800 text-emerald-600 dark:text-emerald-400"
            : "border-primary-200 dark:border-primary-800 text-primary-500 dark:text-primary-400",
        )}
      >
        {isSelected ? (
          <Check className="size-3.5" />
        ) : (
          <Plus className="size-3.5" />
        )}
      </div>
    </Button>
  );
}
