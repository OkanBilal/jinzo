import Code from "@/components/ui/icons/space/code";
import { BaseTab } from "./base-tab";

interface EditorTabProps {
  isActive: boolean;
  onClick: () => void;
  hasFile?: boolean;
  fileName?: string;
  onClose?: (e: React.MouseEvent) => void;
  variant?: "copilot" | "claude";
}

export function EditorTab({ isActive, onClick, hasFile, fileName, onClose, variant }: EditorTabProps) {
  return (
    <BaseTab
      isActive={isActive}
      onClick={onClick}
      onClose={onClose}
      icon={<Code className="size-4.5 shrink-0" />}
      label={
        <span className="text-s truncate flex-1">
          {fileName || "Editor"}
          {hasFile && <span className="ml-1 opacity-60">*</span>}
        </span>
      }
      variant={variant}
    />
  );
}
