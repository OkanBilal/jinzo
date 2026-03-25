import { Edit, Trash } from "@/components/ui/icons";
import type { Space } from "@/lib/redux/api";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui";

interface SpaceContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  space: Space | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function SpaceContextMenu({
  isOpen,
  position,
  space,
  onEdit,
  onDelete,
  onClose,
}: SpaceContextMenuProps) {
  if (!space) return null;
  const isSystemSpace = space.slug === "claude" || space.slug === "copilot" || space.slug === "codex";

  return (
    <DropdownMenu isOpen={isOpen} position={position} onClose={onClose}>
      <DropdownMenuItem
        onClick={() => {
          if (!isSystemSpace) {
            onEdit();
            onClose();
          }
        }}
        disabled={isSystemSpace}
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
