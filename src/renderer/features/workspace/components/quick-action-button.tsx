import { Button } from "@/components/ui/button";

interface QuickActionButtonProps {
  label: string;
  onClick: () => void;
  hasArrow?: boolean;
  variant?: "claude" | "copilot";
}

export function QuickActionButton({
  label,
  onClick,
  hasArrow,
  variant,
}: QuickActionButtonProps) {
  return (
    <Button
      variant="bare"
      onClick={onClick}
      className={`active:scale-99 hover:scale-101 px-4 py-2 cursor-pointer text-sm ${
        variant === "claude"
          ? "glass-morphism-claude text-claude-blue dark:text-claude-lightblue/80 dark:hover:text-claude-lightblue hover:text-claude-blue border-claude-blue rounded-2xl hover:border-claude-lightblue hover:bg-claude-blue/30 transition-all flex items-center gap-2"
          : "glass-morphism-copilot text-copilot-blue dark:text-copilot-lightblue/80 dark:hover:text-copilot-lightblue hover:text-copilot-blue border-copilot-blue rounded-2xl hover:border-copilot-lightblue hover:bg-copilot-blue/30 transition-all flex items-center gap-2"
      }`}
    >
      <span>{label}</span>
      {hasArrow && <span className="text-copilot-lightblue">↗</span>}
    </Button>
  );
}
