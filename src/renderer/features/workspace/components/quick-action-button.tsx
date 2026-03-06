import { Button } from "@/components/ui";
import { SelectOption } from "@/components/ui/icons";

interface QuickActionButtonProps {
  label: string;
  onClick: () => void;
  hasArrow?: boolean;
  icon?: React.ReactNode;
}

export function QuickActionButton({
  label,
  onClick,
  hasArrow,
  icon,
}: QuickActionButtonProps) {
  return (
    <Button
      variant="bare"
      onClick={onClick}
      className="active:scale-99 hover:scale-101 px-4 py-2 cursor-pointer text-sm rounded-2xl
      text-primary-900 dark:text-primary flex items-center gap-2 glass-morphism"
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      {hasArrow && <SelectOption className="ml-1 size-3" />}
    </Button>
  );
}
