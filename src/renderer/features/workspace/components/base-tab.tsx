import { Close } from "@/components/ui/icons";

interface BaseTabProps {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: React.ReactNode;
  onClose?: (e: React.MouseEvent) => void;
  closeIcon?: React.ReactNode;
  variant?: "copilot" | "claude";
}

const activeVariantClass: Record<string, string> = {
  claude: "dark:bg-claude-dark bg-primary",
  copilot: "dark:bg-copilot-dark bg-primary",
};

export function BaseTab({
  isActive,
  onClick,
  icon,
  label,
  onClose,
  closeIcon,
  variant = "copilot",
}: BaseTabProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group flex items-center gap-2 pl-3 pr-1 py-2.5 cursor-pointer transition-colors min-w-40 max-w-48 ${
        isActive
          ? `text-primary-950 dark:text-primary-200 ${activeVariantClass[variant] || ""}`
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300"
      }`}
    >
      {icon}
      {typeof label === "string" ? (
        <span className="text-xs font-medium truncate flex-1">{label}</span>
      ) : (
        label
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/10 cursor-pointer rounded transition-all"
        >
          {closeIcon || <Close className="size-3" />}
        </button>
      )}
    </div>
  );
}
