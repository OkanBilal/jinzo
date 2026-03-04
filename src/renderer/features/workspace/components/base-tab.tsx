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
      className={`group relative flex items-center gap-2 pl-3 pr-3 py-3 cursor-pointer transition-colors min-w-40 max-w-48 ${
        isActive
          ? `text-primary-950 dark:text-primary-200 ${activeVariantClass[variant] || ""}`
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300"
      }`}
    >
      <span className="flex items-center justify-center size-4.5 shrink-0">
        {icon}
      </span>
      {typeof label === "string" ? (
        <span className="text-xs font-medium truncate flex-1">{label}</span>
      ) : (
        label
      )}
      {onClose && (
        <CloseOverlay isActive={isActive} variant={variant} onClose={onClose} closeIcon={closeIcon} />
      )}
    </div>
  );
}

function CloseOverlay({
  isActive,
  variant,
  onClose,
  closeIcon,
}: {
  isActive: boolean;
  variant: string;
  onClose: (e: React.MouseEvent) => void;
  closeIcon?: React.ReactNode;
}) {
  // Build the gradient background that matches the tab bg
  // Active tabs have a solid bg color; inactive tabs sit on the page bg
  const darkBg = variant === "claude" ? "var(--color-claude-dark)" : "var(--color-copilot-dark)";
  const lightBg = "var(--color-primary, #ffffff)";

  // For inactive tabs, they're transparent — fade from page background
  const inactiveDark = "var(--color-bg, #0a0a0a)";
  const inactiveLight = "var(--color-bg, #ffffff)";

  const fromDark = isActive ? darkBg : inactiveDark;
  const fromLight = isActive ? lightBg : inactiveLight;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 flex items-center pr-1 pl-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"

    >
      {/* Light-mode overlay */}
      <div
        className="absolute inset-0 block dark:hidden rounded-r-[inherit]"
        style={{
          background: `linear-gradient(to left, ${fromLight} 60%, transparent)`,
        }}
      />
      {/* Dark-mode overlay */}
      <div
        className="absolute inset-0 hidden dark:block rounded-r-[inherit]"
        style={{
          background: `linear-gradient(to left, ${fromDark} 60%, transparent)`,
        }}
      />
      <button
        onClick={onClose}
        className="relative z-10 p-1 hover:bg-primary/3 cursor-pointer rounded transition-all pointer-events-auto"
      >
        {closeIcon || <Close className="size-3" />}
      </button>
    </div>
  );
}
