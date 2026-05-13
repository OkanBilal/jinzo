import { BoltFill } from "@/components/ui/icons";
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
          ? "dark:bg-primary-200/10 gap-1 bg-primary-400/20 text-primary-600 dark:text-primary-200"
          : "text-primary-700 dark:text-primary-300 hover:bg-primary/10"
      }`}
      title={
        fastMode
          ? "Fast mode on — faster output, same model"
          : "Fast mode off — standard speed"
      }
    >
      {fastMode ? (
        <BoltFill
          className="size-4 transition-colors text-primary-600 dark:text-primary-200"
          style={{
            transitionDelay: "0ms",
            transitionDuration: "150ms",
          }}
        />
      ) : (
        <Bolt
          className="size-4 transition-colors text-primary-700 dark:text-primary-300"
          style={{
            transitionDelay: "200ms",
            transitionDuration: "150ms",
          }}
        />
      )}
      <span
        className={`inline-block overflow-hidden whitespace-nowrap text-primary-600 dark:text-primary-200 transition-[max-width,opacity,transform] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          fastMode
            ? "max-w-11 translate-x-0 opacity-100 duration-300"
            : "max-w-0 -translate-x-0.5 opacity-0 duration-200"
        }`}
      >
        Fast
      </span>
    </Button>
  );
}
