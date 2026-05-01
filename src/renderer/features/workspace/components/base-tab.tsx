import { Close } from "@/components/ui/icons";
import { useAppSelector } from "@/lib/redux/hooks";

interface BaseTabProps {
  isActive: boolean;
  isFirst?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: React.ReactNode;
  onClose?: (e: React.MouseEvent) => void;
  closeIcon?: React.ReactNode;
}

const COLORS = {
  light: "var(--color-primary, #ffffff)",
  dark: "var(--color-primary-950)",
};

export function BaseTab({
  isActive,
  isFirst,
  onClick,
  icon,
  label,
  onClose,
  closeIcon,
}: BaseTabProps) {
  const sidebarCollapsed = useAppSelector((state) => state.appSettings.sidebarCollapsed);

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
      className="group relative flex items-center gap-1 pl-2.5 pr-6 py-1.5 cursor-pointer w-44 min-h-10"
    >
      {/* Active background layer — always rendered, opacity transitions */}
      <div
        className={` bg-primary dark:bg-primary-950 absolute inset-0 rounded-t-2xl transition-opacity duration-150 ease-out ${isActive ? "opacity-100" : "opacity-0"}`}

      />
      <div
        className={`absolute inset-0 rounded-t-2xl transition-opacity duration-150 ease-out hidden dark:block ${isActive ? "opacity-100" : "opacity-0"}`}
        style={{
          backgroundColor: COLORS.dark,
          boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--color-primary) 20%, transparent)",
        }}
      />

      {/* Inverted corners — always rendered, opacity transitions */}
      <InvertedCorner side="left" visible={isActive && (!isFirst || sidebarCollapsed)} />
      <InvertedCorner side="right" visible={isActive} />

      {/* Content */}
      <span className={`relative flex items-center justify-center size-4.5 shrink-0 transition-colors duration-150 ${
        isActive ? "text-primary-900 dark:text-primary-200" : "text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200"
      }`}>
        {icon}
      </span>
      <span className={`relative min-w-0 flex-1 mb-0.5 truncate transition-colors duration-150 ${
        isActive ? "text-primary-900 dark:text-primary-200" : "text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200"
      }`}>
        {typeof label === "string" ? (
          <span className="text-xs font-medium">{label}</span>
        ) : (
          label
        )}
      </span>
      {onClose && (
        <CloseOverlay isActive={isActive} onClose={onClose} closeIcon={closeIcon} />
      )}
    </div>
  );
}

function InvertedCorner({ side, visible }: { side: "left" | "right"; visible: boolean }) {
  const isLeft = side === "left";

  return (
    <>
      <div
        className={`absolute bottom-0 ${isLeft ? "-left-3" : "-right-3"} size-3 block dark:hidden transition-opacity duration-150 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
        style={{
          background: `radial-gradient(circle at ${isLeft ? "top left" : "top right"}, transparent 12px, ${COLORS.light} 12px)`,
        }}
      />
      <div
        className={`absolute bottom-0 ${isLeft ? "-left-3" : "-right-3"} size-3 hidden dark:block transition-opacity duration-150 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
        style={{
          background: `radial-gradient(circle at ${isLeft ? "top left" : "top right"}, transparent 12px, ${COLORS.dark} 12px)`,
        }}
      />
    </>
  );
}

function CloseOverlay({
  isActive,
  onClose,
  closeIcon,
}: {
  isActive: boolean;
  onClose: (e: React.MouseEvent) => void;
  closeIcon?: React.ReactNode;
}) {
  return (
    <div
      className="absolute right-0 top-0.5 bottom-0 flex items-center pr-1.5 pl-6.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
    >
      {isActive && (
        <>
          <div
            className="absolute inset-0 block dark:hidden rounded-r-2xl"
            style={{ background: `linear-gradient(to left, ${COLORS.light} 60%, transparent)` }}
          />
          <div
            className="absolute inset-0 hidden dark:block rounded-r-2xl"
            style={{ background: `linear-gradient(to left, ${COLORS.dark} 60%, transparent)` }}
          />
        </>
      )}
      <button
        onClick={onClose}
        className="relative z-(--z-base) p-1 hover:bg-primary/5 cursor-pointer rounded transition-all pointer-events-auto"
      >
        {closeIcon || <Close className="size-3.25 text-primary-900 dark:text-primary hover:text-primary-900 dark:hover:text-primary-200" />}
      </button>
    </div>
  );
}
