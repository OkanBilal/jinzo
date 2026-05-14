import { solidColors, getThemeVariant } from "@/lib/space-themes";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

interface SpaceThemeSelectorProps {
  selectedColorIndex: number;
  onSelectColor: (index: number) => void;
  /** Tighter swatches and padding (e.g. sidebar context menu) */
  compact?: boolean;
}

export default function SpaceThemeSelector({
  selectedColorIndex,
  onSelectColor,
  compact = false,
}: SpaceThemeSelectorProps) {
  const { darkMode } = useDarkMode();

  return (
    <div
      className={cn(
        "overflow-hidden",
        "bg-primary-950/5 dark:bg-primary/5",
        "shadow-(--shadow-inset-subtle) dark:shadow-(--shadow-inset-subtle-dark)",
        compact ? "rounded-lg" : "rounded-2xl",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center",
          compact ? "gap-1.5 px-1.5 py-1.5" : "gap-2 px-3 py-2.5",
        )}
      >
        {solidColors.map((colorPair, index) => {
          const variant = getThemeVariant(colorPair, darkMode);
          return (
            <Button
              key={`solid-${colorPair.name}`}
              type="button"
              onClick={() => onSelectColor(index)}
              className={cn(
                "rounded-full transition-all duration-200 cursor-pointer shrink-0",
                compact ? "size-5" : "w-5 h-5",
                selectedColorIndex === index
                  ? compact
                    ? "ring-1 ring-primary-300 dark:ring-primary-700 scale-110"
                    : "ring-2 ring-primary-200 scale-105"
                  : "",
              )}
              style={{ background: variant.preview }}
              title={colorPair.name}
            />
          );
        })}
      </div>
    </div>
  );
}
