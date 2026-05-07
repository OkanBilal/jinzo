import { getThemeVariant, solidColors } from "@/lib/space-themes";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

interface SpaceThemePickerProps {
  selectedColorIndex: number;
  onSelectColor: (index: number) => void;
}

export function SpaceThemePicker({
  selectedColorIndex,
  onSelectColor,
}: SpaceThemePickerProps) {
  const { darkMode } = useDarkMode();

  return (
    <div className="flex items-center justify-center gap-4">
      {solidColors.map((colorPair, index) => {
        const isSelected = selectedColorIndex === index;
        return (
          <Button
            key={`theme-${colorPair.name}-${index}`}
            type="button"
            onClick={() => onSelectColor(index)}
            title={colorPair.name}
            className={cn(
              "size-8 rounded-full shrink-0 cursor-pointer",
              "border border-primary-950/15 dark:border-primary/15",
              "transition-transform duration-200 ease-out",
              "ring-offset-2 ring-offset-primary dark:ring-offset-primary-950",
              isSelected
                ? "ring-2 ring-primary-950/70 dark:ring-primary scale-110"
                : "hover:scale-110",
            )}
            style={{
              background: getThemeVariant(colorPair, darkMode).preview,
            }}
          />
        );
      })}
    </div>
  );
}
