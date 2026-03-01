import { Button } from "@/components/ui/button";
import { SelectOption } from "@/components/ui/icons";

interface QuickActionButtonProps {
  label: string;
  onClick: () => void;
  hasArrow?: boolean;
  variant?: "claude" | "copilot";
  icon?: React.ReactNode;
}

export function QuickActionButton({
  label,
  onClick,
  hasArrow,
  variant,
  icon,
}: QuickActionButtonProps) {
  return (
    <Button
      variant="bare"
      onClick={onClick}
      className={`active:scale-99 hover:scale-101 px-4 py-2 cursor-pointer text-sm rounded-[14px] ${
        variant === "claude"
          ? "glass-morphism-claude text-primary-900 dark:text-primary dark:text-claude-light/80 dark:hover:text-claude-light hover:text-claude-blue border-claude-blue hover:border-claude-light hover:bg-claude-blue/30 transition-all flex items-center gap-2"
          : "glass-morphism-copilot text-copilot-blue dark:text-copilot-light/80 dark:hover:text-copilot-light hover:text-copilot-blue border-copilot-blue hover:border-copilot-light hover:bg-copilot-blue/30 transition-all flex items-center gap-2"
      }`}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      {hasArrow && <SelectOption className="ml-1 size-3" />}
    </Button>
  );
}
