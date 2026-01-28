import Code from "@/components/ui/icons/mood/code";

interface EditorTabProps {
  isActive: boolean;
  onClick: () => void;
  hasFile?: boolean;
  fileName?: string;
}

export function EditorTab({ isActive, onClick, hasFile, fileName }: EditorTabProps) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 pl-3 pr-3 mx-1 py-3 cursor-pointer transition-colors min-w-28 max-w-32 ${
        isActive
          ? "text-primary-800 dark:text-primary-200 border-b-2 border-primary-500 dark:border-primary/40 bg-primary-200/30 dark:bg-copilot-blue/80"
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300"
      }`}
    >
      <Code className="w-4 h-4 shrink-0" />
      <span className="text-xs truncate flex-1">
        {fileName || "Editor"}
        {hasFile && <span className="ml-1 opacity-60">*</span>}
      </span>
    </div>
  );
}
