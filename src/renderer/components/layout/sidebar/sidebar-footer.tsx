import type { CSSProperties } from "react";
import { useEffect } from "react";
import { Settings, Question } from "@/components/ui/icons";
import SpaceSelector from "./space-selector";
import type { Space } from "@/lib/redux/api";
import { Button } from "@/components/ui";

interface SidebarFooterProps {
  spaces: Space[];
  activeSpaceId: string | null;
  onSpaceChange: (spaceId: string) => void;
  onSpaceContextMenu?: (space: Space, event: React.MouseEvent) => void;
  onSettingsClick: () => void;
  onPlusClick: (event: React.MouseEvent) => void;
  onHelpClick: (event: React.MouseEvent) => void;
}

export function SidebarFooter({
  spaces,
  activeSpaceId,
  onSpaceChange,
  onSpaceContextMenu,
  onSettingsClick,
  onHelpClick,
}: SidebarFooterProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onSettingsClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onSettingsClick]);

  return (
    <div
      className="px-4 py-3 space-y-3"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <div className="flex items-center justify-between gap-3"

              style={{
          animation: `slide-from-bottom 0.2s ease-out 0.1s both`,
        }}>
        <div>
          <Button
            onClick={onSettingsClick}
            className="shrink-0 flex items-center justify-center transition-transform duration-300 cursor-pointer"
            aria-label="Settings"
            title="Settings"
            tooltipShortcut="⌘S"
            tooltip="Open Settings"
            tooltipPosition="top-right"
          >
            <Settings className="size-4.5 text-primary-900 dark:text-primary-200 hover:text-primary-950 dark:hover:text-primary-100 transition-colors duration-300" />
          </Button>
        </div>
        <div className="">
          <SpaceSelector
            spaces={spaces}
            activeSpaceId={activeSpaceId}
            onSpaceChange={onSpaceChange}
            onContextMenu={onSpaceContextMenu}
          />
        </div>
        <div>
          <Button
            tooltip="Help & Resources"
            tooltipPosition="top"
            onClick={onHelpClick}
            className=" cursor-pointer transition-transform duration-300 "
            aria-label="Help & Resources"
            title="Help & Resources"
          >
            <Question className="size-4.5 mt-1 text-primary-900 dark:text-primary-200 hover:text-primary-950 dark:hover:text-primary-100 transition-colors duration-300" />
          </Button>
        </div>
      </div>
    </div>
  );
}
