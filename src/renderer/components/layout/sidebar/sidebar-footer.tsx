import type { CSSProperties } from "react";
import { Settings, Plus } from "@/components/ui/icons";
import MoodSelector from "./mood-selector";
import type { Mood } from "@/lib/redux/api";
import { Button } from "@/components/ui/button";

interface SidebarFooterProps {
  moods: Mood[];
  activeMoodId: string | null;
  onMoodChange: (moodId: string) => void;
  onMoodContextMenu?: (mood: Mood, event: React.MouseEvent) => void;
  onSettingsClick: () => void;
  onPlusClick: (event: React.MouseEvent) => void;
}

export function SidebarFooter({
  moods,
  activeMoodId,
  onMoodChange,
  onMoodContextMenu,
  onSettingsClick,
  onPlusClick,
}: SidebarFooterProps) {
  return (
    <div
      className="px-4 py-4 space-y-3"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button
            onClick={onSettingsClick}
            className="shrink-0 flex items-center justify-center transition-transform duration-300 cursor-pointer hover:rotate-90"
            aria-label="Settings"
            title="Settings"
            tooltip="Open Settings"
            tooltipPosition="right"
          >
            <Settings className="size-5 text-primary-700 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-100 transition-colors duration-300" />
          </Button>
        </div>
        <div className="">
          <MoodSelector
            moods={moods}
            activeMoodId={activeMoodId}
            onMoodChange={onMoodChange}
            onContextMenu={onMoodContextMenu}
          />
        </div>
        <div>
          <Button
            tooltip="Create new mood"
            tooltipPosition="right"
            onClick={onPlusClick}
            className=" cursor-pointer transition-transform duration-300  hover:rotate-45"
            aria-label="Create new mood"
            title="Create new mood"
          >
            <Plus className="size-5 text-primary-700 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-100 transition-colors duration-300" />
          </Button>
        </div>
      </div>
    </div>
  );
}
