import { Close, Document, Notes } from "@/components/ui/icons";
import type { ReviewTab } from "@/lib/redux/slices/workspaceSlice";

interface NoteTabProps {
  review: ReviewTab;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  variant?: "workspace" | "claude";
}

export function NoteTab({ review, isActive, onClick, onClose, variant }: NoteTabProps) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 pl-3 pr-1 py-2.5 cursor-pointer transition-colors min-w-40 max-w-48 ${
        isActive
          ? `text-primary-950 dark:text-primary-200 ${variant === "claude" ? "dark:bg-claude-dark bg-primary" : "dark:bg-copilot-dark bg-primary"}`
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300"
      }`}
    >
      <Document className="w-4 h-4" />
      <span className="text-sm font-medium truncate flex-1">{review.title}</span>
      <button
        onClick={onClose}
        className="opacity-0 group-hover:opacity-100 p-0.5 mr-1 hover:bg-primary/10 cursor-pointer rounded transition-all"
      >
        <Close className="w-3 h-3" />
      </button>
    </div>
  );
}
