import { useState, useCallback, memo } from "react";
import { Edit, Trash } from "@/components/ui/icons";
import type { Space } from "@/lib/redux/api";
import { useUpdateSpaceMutation } from "@/lib/redux/api";
import { DropdownMenu, DropdownMenuItem, toast } from "@/components/ui";
import { solidColors, parseThemeConfig } from "@/lib/space-themes";
import SpaceThemeSelector from "./space-theme-selector";

const SpaceContextThemeSection = memo(function SpaceContextThemeSection({
  space,
}: {
  space: Space;
}) {
  const [updateSpace, { isLoading: isSavingTheme }] = useUpdateSpaceMutation();
  const { colorIndex: initialIndex } = parseThemeConfig(space.themeConfig);
  const [selectedColorIndex, setSelectedColorIndex] = useState(() => initialIndex);

  const handleSelectColor = useCallback(
    async (index: number) => {
      setSelectedColorIndex(index);
      const colorPair = solidColors[index] ?? solidColors[0];
      const themeConfig = JSON.stringify({
        lightBackground: colorPair.light.value,
        darkBackground: colorPair.dark.value,
      });
      try {
        await updateSpace({ id: space.id, payload: { themeConfig } }).unwrap();
        toast.success("Space theme updated");
      } catch (error) {
        console.error("Error updating space theme:", error);
        toast.error("Failed to update theme");
      }
    },
    [space, updateSpace],
  );

  return (
    <div
      className={`px-2 pb-3 ${
        isSavingTheme ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <span className="px-0.5 py-2 text-[12px] leading-tight text-primary-500 dark:text-primary-500 block">
        Space theme
      </span>
      <SpaceThemeSelector
        compact
        selectedColorIndex={selectedColorIndex}
        onSelectColor={handleSelectColor}
      />
    </div>
  );
});

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
  const isSystemSpace =
    space.slug === "claude" ||
    space.slug === "copilot" ||
    space.slug === "codex" ||
    space.slug === "cursor";

  return (
    <DropdownMenu
      isOpen={isOpen}
      position={position}
      onClose={onClose}
      minWidth={200}
      className="p-0!"
    >
      <SpaceContextThemeSection
        key={`${space.id}-${space.themeConfig ?? ""}`}
        space={space}
      />

    </DropdownMenu>
  );
}
