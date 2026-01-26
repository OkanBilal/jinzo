import { Close, CopilotStatic } from "@/components/ui/icons";
import type { Run } from "../types";

interface RunTabProps {
  run: Run;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  title: string;
}

export function RunTab({ run, isActive, onClick, onClose, title }: RunTabProps) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 pl-3 pr-1 py-3 cursor-pointer border-r border-[#21262d] transition-colors min-w-40 max-w-48 ${
        isActive
          ? "bg-[rgb(20,23,26)] text-primary-200"
          : "bg-transparent text-primary-500 hover:bg-[rgb(16,19,22)] hover:text-primary-300"
      }`}
    >
      <CopilotStatic className="w-4 h-4 shrink-0" />
      <span className="text-xs truncate flex-1">{title}</span>
      <button
        onClick={onClose}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-primary-700/50 rounded transition-all"
      >
        <Close className="w-3 h-3" />
      </button>
    </div>
  );
}

export function getTabTitle(run: Run): string {
  if (run.title) return run.title;
  if (run.goal) {
    const truncated = run.goal.length > 25 ? run.goal.substring(0, 25) + "..." : run.goal;
    return truncated;
  }
  return `Run ${run.id.substring(0, 8)}`;
}
