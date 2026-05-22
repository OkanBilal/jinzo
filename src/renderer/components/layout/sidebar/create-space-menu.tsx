import { Preset } from "@/components/ui/icons";
import { Bolt } from "@/components/ui/icons/space";
import { Caption, DropdownMenu, DropdownMenuItem } from "@/components/ui";

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
        <Caption>Create Space</Caption>
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          onPresetSpaces();
          onClose();
        }}
      >
        <Preset className="size-4" />
        <Caption>Choose Space</Caption>
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
