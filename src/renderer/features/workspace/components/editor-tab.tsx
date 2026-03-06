import Code from "@/components/ui/icons/space/code";
import { BaseTab } from "./base-tab";

interface EditorTabProps {
  isActive: boolean;
  isFirst?: boolean;
  onClick: () => void;
  hasFile?: boolean;
  fileName?: string;
  onClose?: (e: React.MouseEvent) => void;
  variant?: "copilot" | "claude";
}

export function EditorTab({ isActive, isFirst, onClick, hasFile, fileName, onClose, variant }: EditorTabProps) {
  return (
    <BaseTab
      isActive={isActive}
      isFirst={isFirst}
      onClick={onClick}
      onClose={onClose}
      icon={<Code className="size-4.5 shrink-0 text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200 " />}
      label={
        <span className="text-s truncate text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200  flex-1">
          {fileName || "Editor"}
          {hasFile && <span className="ml-1 ">*</span>}
        </span>
      }
      variant={variant}
    />
  );
}
