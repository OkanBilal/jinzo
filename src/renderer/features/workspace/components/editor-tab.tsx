import Code from "@/components/ui/icons/mood/code";
import { Close } from "@/components/ui/icons";

interface EditorTabProps {
  isActive: boolean;
  onClick: () => void;
  hasFile?: boolean;
  fileName?: string;
  onClose?: (e: React.MouseEvent) => void;
  variant?: "workspace" | "claude";
}

export function EditorTab({
  isActive,
  onClick,
  hasFile,
  fileName,
  onClose,
  variant,
}: EditorTabProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`group flex items-center gap-2 pl-3 pr-1 py-2.5 cursor-pointer transition-colors min-w-40 max-w-48 ${
        isActive
          ? `text-primary-950 dark:text-primary-200  ${variant=== "claude" ? "dark:bg-claude-dark bg-primary" : variant === "workspace" ? " dark:bg-copilot-dark bg-primary" : ""} `
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 "
      }`}
    >
      <Code className="size-4.5 shrink-0" />
      <span className="text-[13px] truncate flex-1">
        {fileName || "Editor"}
        {hasFile && <span className="ml-1 opacity-60">*</span>}
      </span>
      {onClose && (
        <button
          onClick={onClose}
          className="opacity-0 group-hover:opacity-100 p-0.5 mr-0.5  cursor-pointer rounded transition-all"
        >
          <Close className="size-3" />
        </button>
      )}
    </div>
  );
}
