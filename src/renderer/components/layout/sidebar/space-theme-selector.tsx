import {
  solidColors,
  gradientColors,
  getThemeVariant,
} from "@/lib/space-themes";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { Button } from "@/components/ui";
import { ArrowUp } from "@/components/ui/icons";

interface SpaceThemeSelectorProps {
  selectedColorIndex: number;
  showGradients: boolean;
  onSelectColor: (index: number) => void;
  onToggleGradients: (show: boolean) => void;
}

export default function SpaceThemeSelector({
  selectedColorIndex,
  showGradients,
  onSelectColor,
  onToggleGradients,
}: SpaceThemeSelectorProps) {
  const { darkMode } = useDarkMode();

  return (
    <div
      className="rounded-2xl overflow-hidden
        bg-primary-950/5 dark:bg-primary/4
        shadow-[inset_0_0.5px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]"
    >
      <div
        className="flex transition-transform duration-300 ease-in-out"
        style={{
          transform: showGradients ? "translateX(-100%)" : "translateX(0)",
        }}
      >
        {/* Solid Colors Row */}
        <div className="flex items-center gap-2 px-3 py-2.5 ml-2 min-w-full">
          {solidColors.map((colorPair, index) => {
            const variant = getThemeVariant(colorPair, darkMode);
            return (
              <Button
                key={`solid-${colorPair.name}`}
                type="button"
                onClick={() => {
                  if (!showGradients) onSelectColor(index);
                }}
                className={`
                  w-5 h-5 rounded-full transition-all duration-200 cursor-pointer shrink-0
                  ${
                    !showGradients && selectedColorIndex === index
                      ? "ring-2 ring-primary-200 scale-105"
                      : "hover:scale-101"
                  }
                `}
                style={{ background: variant.preview }}
                title={colorPair.name}
              />
            );
          })}
          <Button
            type="button"
            onClick={() => onToggleGradients(true)}
            className="ml-auto shrink-0 p-0.5 mr-1 rounded-lg hover:bg-primary-950/10 dark:hover:bg-primary/10 transition-colors cursor-pointer"
            title="Show Gradients"
          >
            <ArrowUp className="w-5 h-5 text-primary-700 dark:text-primary-200 rotate-90" />
          </Button>
        </div>

        {/* Gradient Colors Row */}
        <div className="flex items-center gap-2 px-3 mr-2  min-w-full">
          <Button
            type="button"
            onClick={() => onToggleGradients(false)}
            className="shrink-0 -ml-4 mr-1 rounded-lg p-0.5 hover:bg-primary-950/10 dark:hover:bg-primary/10 transition-colors cursor-pointer"
            title="Show Solid Colors"
          >
            <ArrowUp className="w-5 h-5 text-primary-700 dark:text-primary-200 rotate-270" />
          </Button>
          {gradientColors.map((colorPair, index) => {
            const variant = getThemeVariant(colorPair, darkMode);
            return (
              <Button
                key={`gradient-${colorPair.name}`}
                type="button"
                onClick={() => {
                  if (showGradients) onSelectColor(index);
                }}
                className={`
                  w-5 h-5 rounded-full transition-all duration-200 cursor-pointer shrink-0
                  ${
                    showGradients && selectedColorIndex === index
                      ? "ring-2 ring-primary-200 scale-105"
                      : "hover:scale-101"
                  }
                `}
                style={{ background: variant.preview }}
                title={colorPair.name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
