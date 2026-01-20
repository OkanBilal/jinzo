import type { CSSProperties } from "react";
import { Settings, Plus } from "@/components/ui/icons";
import MoodSelector from "./mood-selector";
import type { Mood } from "@/lib/redux/api";

interface SidebarFooterProps {
  moods: Mood[];
  activeMoodId: string | null;
  onMoodChange: (moodId: string) => void;
  onSettingsClick: () => void;
  onCreateMoodClick: () => void;
}

export function SidebarFooter({
  moods,
  activeMoodId,
  onMoodChange,
  onSettingsClick,
  onCreateMoodClick,
}: SidebarFooterProps) {
  return (
    <div
      className="px-4 py-4 space-y-3"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <button
            onClick={onSettingsClick}
            className="shrink-0 flex items-center justify-center transition-transform duration-300 cursor-pointer hover:rotate-90"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="size-5 text-primary-600 dark:text-primary-400 hover:text-primary-400 dark:hover:text-primary-100 transition-colors duration-300" />
          </button>
        </div>
        <div className="">
          <MoodSelector
            moods={moods}
            activeMoodId={activeMoodId}
            onMoodChange={onMoodChange}
          />
        </div>
        <div>
          <button
            onClick={onCreateMoodClick}
            className=" cursor-pointer transition-transform duration-300  hover:rotate-90"
            aria-label="Create new mood"
            title="Create new mood"
          >
            <Plus className="size-5 text-primary-600 dark:text-primary-400 hover:text-primary-400 dark:hover:text-primary-100 transition-colors duration-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
