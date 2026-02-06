import { Preset } from "@/components/ui/icons";
import { Bolt } from "@/components/ui/icons/mood";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface CreateMoodMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onCreateMood: () => void;
  onPresetMoods: () => void;
  onClose: () => void;
}

export default function CreateMoodMenu({
  isOpen,
  position,
  onCreateMood,
  onPresetMoods,
  onClose,
}: CreateMoodMenuProps) {
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
          onCreateMood();
          onClose();
        }}
      >
        <Bolt className="size-4" />
        <span>Create Mood</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          onPresetMoods();
          onClose();
        }}
      >
        <Preset className="size-4" />
        <span>Choose Mood</span>
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
