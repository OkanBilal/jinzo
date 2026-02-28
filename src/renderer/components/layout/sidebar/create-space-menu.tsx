import { Preset } from "@/components/ui/icons";
import { Bolt } from "@/components/ui/icons/space";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface CreateSpaceMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onCreateSpace: () => void;
  onPresetSpaces: () => void;
  onClose: () => void;
}

export default function CreateSpaceMenu({
  isOpen,
  position,
  onCreateSpace,
  onPresetSpaces,
  onClose,
}: CreateSpaceMenuProps) {
  const adjustedPosition = {
    x: Math.max(8, Math.min(position.x - 70, window.innerWidth - 160)),
    y: Math.max(8, position.y - 90),
  };

  return (
    <DropdownMenu
      isOpen={isOpen}
      position={adjustedPosition}
      onClose={onClose}
      minWidth={160}
    >
      <DropdownMenuItem
        onClick={() => {
          onCreateSpace();
          onClose();
        }}
      >
        <Bolt className="size-4" />
        <span>Create Space</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          onPresetSpaces();
          onClose();
        }}
      >
        <Preset className="size-4" />
        <span>Choose Space</span>
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
