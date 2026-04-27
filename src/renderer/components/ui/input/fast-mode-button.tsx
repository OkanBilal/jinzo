import { Bolt } from "@/components/ui/icons/space";
import { Button } from "../button";

interface FastModeButtonProps {
  fastMode: boolean;
  onToggle: () => void;
}

export function FastModeButton({ fastMode, onToggle }: FastModeButtonProps) {
  return (
    <Button
      tooltip="Toggle Fast Mode"
      type="button"
      onClick={onToggle}
      className={`flex items-center pl-2 pr-2.5 py-1 -ml-px rounded-full text-sm transition-all animate-blur-reveal cursor-pointer ${
        fastMode
          ? "dark:bg-orange-200/10 gap-1 bg-orange-300/30 text-orange-400 dark:text-orange-200"
          : "text-primary-700 dark:text-primary-300 hover:bg-primary/10"
      }`}
      title={
        fastMode
          ? "Fast mode on — faster output, same model"
          : "Fast mode off — standard speed"
      }
    >
      <Bolt
        animated={fastMode}
        className={`size-4 transition-colors ${fastMode ? "text-orange-400 dark:text-orange-200" : "text-primary-700 dark:text-primary-300"}`}
        style={{
          transitionDelay: fastMode ? "0ms" : "200ms",
          transitionDuration: "150ms",
        }}
      />
      <span className="flex overflow-hidden">
        {"Fast".split("").map((char, i) => (
          <span
            key={i}
            className="inline-block text-orange-400 dark:text-orange-200"
            style={{
              transition: "opacity 150ms, transform 150ms, max-width 150ms",
              transitionDelay: fastMode ? `${i * 40}ms` : `${(3 - i) * 40}ms`,
              opacity: fastMode ? 1 : 0,
              transform: fastMode ? "translateX(0)" : "translateX(4px)",
              maxWidth: fastMode ? "1ch" : "0px",
            }}
          >
            {char}
          </span>
        ))}
      </span>
    </Button>
  );
}
