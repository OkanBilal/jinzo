import Code from "@/components/ui/icons/space/code";
import { BaseTab } from "./base-tab";

interface EditorTabProps {
  isActive: boolean;
  isFirst?: boolean;
  onClick: () => void;
  hasFile?: boolean;
  fileName?: string;
  onClose?: (e: React.MouseEvent) => void;
}

export function EditorTab({ isActive, isFirst, onClick, hasFile, fileName, onClose }: EditorTabProps) {
  return (
    <BaseTab
      isActive={isActive}
      isFirst={isFirst}
      onClick={onClick}
      onClose={onClose}
      tooltip={fileName || "Editor"}
      icon={<Code className="size-4 shrink-0 text-primary-800 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200 " />}
      label={
        <span className="text-xs tracking-tight font-medium truncate text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200  flex-1">
          {fileName || "Editor"}
          {hasFile && <span className="ml-1 ">*</span>}
        </span>
      }
    />
  );
}
