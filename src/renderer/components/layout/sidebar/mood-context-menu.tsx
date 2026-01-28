import { Edit, Trash } from "@/components/ui/icons";
import type { Mood } from "@/lib/redux/api";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface MoodContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  mood: Mood | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function MoodContextMenu({
  isOpen,
  position,
  mood,
  onEdit,
  onDelete,
  onClose,
}: MoodContextMenuProps) {
  if (!mood) return null;

  return (
    <DropdownMenu isOpen={isOpen} position={position} onClose={onClose}>
      <DropdownMenuItem
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        <Edit className="size-3.5" />
        <span>Edit</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          onDelete();
          onClose();
        }}
        variant="danger"
      >
        <Trash className="size-4" />
        <span>Delete</span>
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
