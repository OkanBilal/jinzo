import { Button } from "@/components/ui";
import { Check } from "@/components/ui/icons";

/** value → occurrence count, sorted by count. */
export function sortedEntries(map: Map<string, number>): [string, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Single-choice group inside the /tasks filter menus — radio-like rows
 * without counts (e.g. the PR state).
 */
export function FilterChoiceSection<T extends string>({
  title,
  options,
  value,
  onSelect,
}: {
  title: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div>
      <div className="px-3 pt-2 pb-1 text-s font-medium text-primary-400 dark:text-primary-500">
        {title}
      </div>
      {options.map((opt) => (
        <Button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800"
        >
          <span className="flex-1 min-w-0 truncate text-s text-primary-800 dark:text-primary-100">
            {opt.label}
          </span>
          {value === opt.value && (
            <Check className="w-3 h-3 shrink-0 text-primary-900 dark:text-primary-100" />
          )}
        </Button>
      ))}
    </div>
  );
}

/** One facet group inside the /tasks filter menus (issues + PRs). */
export function FilterSection({
  title,
  entries,
  selected,
  onToggle,
  renderIcon,
}: {
  title: string;
  entries: [string, number][];
  selected: string[];
  onToggle: (value: string) => void;
  renderIcon?: (value: string) => React.ReactNode;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="px-3 pt-2 pb-1 text-s font-medium text-primary-400 dark:text-primary-500">
        {title}
      </div>
      {entries.map(([value, count]) => {
        const isSelected = selected.includes(value);
        return (
          <Button
            key={value}
            onClick={() => onToggle(value)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800"
          >
            {renderIcon?.(value)}
            <span className="flex-1 min-w-0 truncate text-s text-primary-800 dark:text-primary-100">
              {value}
            </span>
            <span className="shrink-0 text-xxs text-primary-500 dark:text-primary-400 tabular-nums">
              {count}
            </span>
            {isSelected && (
              <Check className="w-3 h-3 shrink-0 text-primary-900 dark:text-primary-100" />
            )}
          </Button>
        );
      })}
    </div>
  );
}
