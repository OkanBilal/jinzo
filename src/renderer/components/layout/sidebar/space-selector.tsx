import { useState } from "react";
import { Space } from "@/lib/redux/api";
import { parseIcon } from "@/lib/icon-registry";
import { Copilot, Claude } from "@/components/ui/icons/space";
import { Button } from "@/components/ui";
import { Codex } from "@/components/ui/icons";

interface SpaceSelectorProps {
  spaces: Space[];
  activeSpaceId: string | null;
  onSpaceChange: (spaceId: string) => void;
  onContextMenu?: (space: Space, event: React.MouseEvent) => void;
}

function SpaceSelector({
  spaces,
  activeSpaceId,
  onSpaceChange,
}: SpaceSelectorProps) {
  const [hoveredSpaceId, setHoveredSpaceId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto noscrollbar px-1 ">
      {spaces.map((space) => {
        const icon = parseIcon(space.icon);
        const isActive = activeSpaceId === space.id;
        const isHovered = hoveredSpaceId === space.id;

        return (
          <Button
            key={space.id}
            onClick={() => onSpaceChange(space.id)}
            // onContextMenu={(e) => {
            //   e.preventDefault();
            //   onContextMenu?.(space, e);
            // }}
            onMouseEnter={() => setHoveredSpaceId(space.id)}
            onMouseLeave={() => setHoveredSpaceId(null)}
            className={`shrink-0 flex items-center justify-center size-8 hover:bg-primary/60 dark:hover:bg-primary/20
              hover:scale-101 rounded-xl transition-all duration-200 ease-out active:scale-99 font-medium cursor-pointer ${
              isActive
                ? "text-primary-900 dark:text-primary"
                : "text-primary-900 dark:text-primary opacity-60"
            }`}
            title={space.name}
            aria-label={space.name}
          >
            {icon.type === "emoji" ? (
              <span className="text-lg font-medium">
                {icon.value as string}
              </span>
            ) : icon.type === "copilot-animate" ? (
              <Copilot className="text-primary-800 dark:text-primary" animate={isHovered} />
            ) : icon.type === "claude-animate" ? (
              <Claude className="text-primary-800 dark:text-primary" animate={isHovered} />
            ) : icon.type === "codex-animate" ? (
              <Codex
                className={`size-4 text-primary-800 dark:text-primary`}
              />
            ) : (
              <icon.value className="size-4" />
            )}
          </Button>
        );
      })}
    </div>
  );
}

export default SpaceSelector;
