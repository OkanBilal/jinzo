import { Mood } from "@/lib/redux/api";
import { parseIcon } from "@/lib/icon-registry";
import { Chat } from "@/components/ui/icons/mood";

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
  return (
    <div className="flex items-center gap-1 overflow-x-auto noscrollbar px-1">
      {/* No mood option */}
      <button
        onClick={() => onMoodChange("")}
        className={`shrink-0  flex items-center justify-center size-8 hover:bg-primary-100/30 rounded-lg p-1 font-medium transition-all duration-300 cursor-pointer ${
          !activeMoodId
            ? " text-primary-700 dark:text-primary-200"
            : " text-primary-600 dark:text-primary-500 opacity-60"
        }`}
        title="No mood"
        aria-label="No mood"
      >
        <Chat className="size-4.5" />
      </button>

      {moods.map((mood) => {
        const icon = parseIcon(mood.icon);
        const isActive = activeMoodId === mood.id;

        return (
          <button
            key={mood.id}
            onClick={() => onMoodChange(mood.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu?.(mood, e);
            }}
            className={`shrink-0 flex items-center justify-center size-8 hover:bg-primary-100/30 rounded-lg p-1 transition-all duration-300 cursor-pointer ${
              isActive
                ? "text-primary-700 dark:text-primary-200"
                : "text-primary-600 dark:text-primary-500 opacity-60"
            }`}
            title={mood.name}
            aria-label={mood.name}
          >
            {icon.type === "emoji" ? (
              <span className="text-lg font-medium">{icon.value as string}</span>
            ) : (
              <icon.value className="size-4.5" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default MoodSelector;
