import Code from "@/components/ui/icons/mood/code";
import { Close } from "@/components/ui/icons";

interface EditorTabProps {
  isActive: boolean;
  onClick: () => void;
  hasFile?: boolean;
  fileName?: string;
  onClose?: (e: React.MouseEvent) => void;
}

export function EditorTab({
  isActive,
  onClick,
  hasFile,
  fileName,
  onClose,
}: EditorTabProps) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 pl-3 pr-1 py-3 cursor-pointer transition-colors min-w-28 max-w-32 ${
        isActive
          ? "text-primary-800 dark:text-primary-200 "
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300"
      }`}
    >
      <Code className="w-4 h-4 shrink-0" />
      <span className="text-xs truncate flex-1">
        {fileName || "Editor"}
        {hasFile && <span className="ml-1 opacity-60">*</span>}
      </span>
      {onClose && (
        <button
          onClick={onClose}
          className="opacity-0 group-hover:opacity-100 p-0.5 mr-1 hover:bg-primary/10 cursor-pointer rounded transition-all"
        >
          <Close className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
