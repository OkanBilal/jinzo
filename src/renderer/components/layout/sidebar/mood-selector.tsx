import { Mood } from "@/lib/redux/api";

interface MoodSelectorProps {
  moods: Mood[];
  activeMoodId: string;
  onMoodChange: (moodId: string) => void;
}

function MoodSelector({
  moods,
  activeMoodId,
  onMoodChange,
}: MoodSelectorProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto noscrollbar px-1">
      {/* No mood option */}
      <button
        onClick={() => onMoodChange("")}
        className={`shrink-0  flex items-center justify-center size-8 hover:bg-primary-100/30 rounded-lg p-1 font-medium transition-all duration-300 cursor-pointer ${
          !activeMoodId
            ? " text-primary-500 dark:text-primary-200"
            : " text-primary-400 dark:text-primary-500 opacity-60"
        }`}
        title="No mood"
        aria-label="No mood"
      >
        💬
      </button>

      {moods.map((mood) => (
        <button
          key={mood.id}
          onClick={() => onMoodChange(mood.id)}
          className={`shrink-0  flex items-center justify-center size-8 hover:bg-primary-100/30 rounded-lg p-1 font-semibold uppercase transition-all duration-300 cursor-pointer ${
            activeMoodId === mood.id
              ? " text-primary-500 dark:text-primary-200"
              : " text-primary-400 dark:text-primary-500 opacity-60"
          }`}
          title={mood.name}
          aria-label={mood.name}
        >
          {mood.icon}
        </button>
      ))}
    </div>
  );
}

export default MoodSelector;
