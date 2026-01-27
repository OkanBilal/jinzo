import { useState } from "react";
import { Mood } from "@/lib/redux/api";
import { parseIcon } from "@/lib/icon-registry";
import { Chat, Copilot, Claude } from "@/components/ui/icons/mood";
import { Button } from "@/components/ui/button";

interface MoodSelectorProps {
  moods: Mood[];
  activeMoodId: string | null;
  onMoodChange: (moodId: string) => void;
  onContextMenu?: (mood: Mood, event: React.MouseEvent) => void;
}

function MoodSelector({
  moods,
  activeMoodId,
  onMoodChange,
  onContextMenu,
}: MoodSelectorProps) {
  const [hoveredMoodId, setHoveredMoodId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto noscrollbar px-1 ">
      {/* No mood option */}
      <Button
        onClick={() => onMoodChange("")}
        className={`shrink-0 flex items-center justify-center size-8 hover:bg-primary-100/30 hover:scale-[1.02] rounded-xl transition-all duration-200 ease-out active:scale-[0.98] font-medium cursor-pointer ${
          !activeMoodId
            ? "text-primary-950 dark:text-primary"
            : "text-primary-900 dark:text-primary opacity-60"
        }`}
        title="No mood"
        aria-label="No mood"
      >
        <Chat className="size-4 stroke-primary-950 dark:stroke-primary" />
      </Button>

      {moods.map((mood) => {
        const icon = parseIcon(mood.icon);
        const isActive = activeMoodId === mood.id;
        const isHovered = hoveredMoodId === mood.id;

        return (
          <Button
            key={mood.id}
            onClick={() => onMoodChange(mood.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu?.(mood, e);
            }}
            onMouseEnter={() => setHoveredMoodId(mood.id)}
            onMouseLeave={() => setHoveredMoodId(null)}
        className={`shrink-0 flex items-center justify-center size-8 hover:bg-primary-100/30 hover:scale-[1.02] rounded-xl transition-all duration-200 ease-out active:scale-[0.98] p-1 font-medium cursor-pointer ${
              isActive
                ? "text-primary-950 dark:text-primary"
                : "text-primary-900 dark:text-primary opacity-60"
            }`}
            title={mood.name}
            aria-label={mood.name}
          >
            {icon.type === "emoji" ? (
              <span className="text-lg font-medium">
                {icon.value as string}
              </span>
            ) : icon.type === "copilot-animate" ? (
              <Copilot animate={isHovered} />
            ) : icon.type === "claude-animate" ? (
              <Claude animate={isHovered} />
            ) : (
              <icon.value className="size-4" />
            )}
          </Button>
        );
      })}
    </div>
  );
}

export default MoodSelector;
