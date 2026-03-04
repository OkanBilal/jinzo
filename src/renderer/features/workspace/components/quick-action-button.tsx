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
          ? "glass-morphism-claude text-primary-900 dark:text-primary  dark:hover:text-claude-light hover:text-claude-blue border-claude-blue hover:border-claude-light hover:bg-claude-blue/30 transition-all flex items-center gap-2"
          : "glass-morphism-copilot text-copilot-dark dark:text-copilot-light/80 dark:hover:text-copilot-light hover:text-copilot-dark border-copilot-dark hover:border-copilot-light hover:bg-copilot-dark/30 transition-all flex items-center gap-2"
      }`}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      {hasArrow && <SelectOption className="ml-1 size-3" />}
    </Button>
  );
}
