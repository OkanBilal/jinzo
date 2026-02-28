import { Note } from "@/components/ui/icons";
import type { ReviewTab } from "@/lib/redux/slices/workspaceSlice";
import { BaseTab } from "./base-tab";

interface NoteTabProps {
  review: ReviewTab;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  variant?: "copilot" | "claude";
}

export function NoteTab({ review, isActive, onClick, onClose, variant }: NoteTabProps) {
  return (
    <BaseTab
      isActive={isActive}
      onClick={onClick}
      onClose={onClose}
      icon={<Note className="w-4 h-4" />}
      label={review.title}
      variant={variant}
    />
  );
}
