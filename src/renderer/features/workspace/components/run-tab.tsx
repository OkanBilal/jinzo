import { Close, CopilotStatic } from "@/components/ui/icons";
import type { Run } from "../types";
import { Copilot } from "@/components/ui/icons/mood";

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
      className={`group flex items-center gap-2 pl-3 pr-1 py-3 cursor-pointer first:border-l  border-r border-[#21262d] transition-colors min-w-40 max-w-48 ${
        isActive
          ? "bg-[#161a1f] text-primary-200"
          : "bg-[#0c0f11] text-primary-500 hover:bg-[#101316] hover:text-primary-300"
      }`}
    >
      <Copilot className=" shrink-0" size={16} />
      <span className="text-xs truncate flex-1">{title}</span>
      <button
        onClick={onClose}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-primary/10 cursor-pointer rounded transition-all"
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
