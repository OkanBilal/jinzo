import { RefObject } from "react";
import { Brain, ArrowUp } from "../icons";
import DropdownWrapper from "../dropdown-wrapper";
import { Button } from "../button";

type EffortLevel = "minimal" | "low" | "medium" | "high" | "max" | "xhigh";

interface EffortLevelDropdownProps {
  variant: "claude" | "copilot" | "codex" | "cursor";
  thinkingMode: boolean;
  effortLevel: string;
  onEffortLevelChange: (level: string) => void;
  onThinkingModeToggle: () => void;
  supportedEffortLevels?: EffortLevel[];
  /** Claude-only: show an "Ultracode" entry at the bottom (model supports xhigh). */
  supportsUltracode?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
}

/** Ultracode label — ocean (cyan → blue → indigo). */
const ULTRACODE_GRADIENT = {
  text: "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400",
  icon: "text-blue-500 dark:text-blue-400",
} as const;

function formatEffortLabel(level: string): string {
  if (level === "ultracode") return "Ultracode";
  return level === "xhigh" ? "Extra High" : level;
}

export function EffortLevelDropdown({
  variant,
  thinkingMode,
  effortLevel,
  onEffortLevelChange,
  onThinkingModeToggle,
  supportedEffortLevels,
  supportsUltracode,
  isOpen,
  onToggle,
  dropdownRef,
}: EffortLevelDropdownProps) {
  const hasEffortLevels = supportedEffortLevels && supportedEffortLevels.length > 0;

  if (!hasEffortLevels && variant !== "claude") return null;

  if (!hasEffortLevels && variant === "claude") {
    return (
      <Button
        tooltip="Toggle Thinking Mode"
        type="button"
        onClick={onThinkingModeToggle}
        className={`flex items-center gap-1 px-2 py-1 -ml-px rounded-full text-sm  transition-all cursor-pointer animate-blur-reveal ${
          thinkingMode
            ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-700 dark:text-primary-100"
            : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
        }`}
      >
        <Brain
          className={`size-4 ${thinkingMode ? "text-primary-700 dark:text-primary-100" : "text-primary-400 dark:text-primary-300"}`}
        />
        <span
          className={
            thinkingMode ? "text-primary-700 dark:text-primary-100" : "text-primary-400 dark:text-primary-300"
          }
        >
          {thinkingMode ? "On" : "Off"}
        </span>
      </Button>
    );
  }

  return (
    <div className="relative animate-blur-reveal" ref={dropdownRef}>
      <Button
        tooltip="Thinking & Effort"
        type="button"
        onClick={onToggle}
        className={`flex items-center hover:bg-primary-200/30 dark:hover:bg-primary-800 px-2 py-1 -ml-px rounded-full text-sm  transition-all cursor-pointer ${
          thinkingMode
            ? "gap-1 text-primary-400 dark:text-primary-300"
            : "text-primary-400 dark:text-primary-300 hover:bg-primary/10"
        }`}
      >
        <span
          className={
            !thinkingMode
              ? ""
              : effortLevel === "ultracode"
                ? `capitalize tracking-tight font-medium ${ULTRACODE_GRADIENT.text}`
                : "text-primary-700 dark:text-primary-300 capitalize tracking-tight"
          }
        >
          {thinkingMode ? formatEffortLabel(effortLevel) || "On" : "Off"}
        </span>
        <ArrowUp
          className={`size-3.5 ml-0.5 rotate-180 ${
            !thinkingMode
              ? "text-primary-400 dark:text-primary-300"
              : effortLevel === "ultracode"
                ? "text-indigo-500 dark:text-indigo-400"
                : "text-primary-700 dark:text-primary-300"
          }`}
        />
      </Button>
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-32"
      >
        {variant !== "codex" && (
          <Button
            type="button"
            onClick={() => {
              onEffortLevelChange("");
              onToggle();
            }}
            className={`w-full text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors first:rounded-t-xl ${
              !thinkingMode
                ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-500 dark:text-primary-100 "
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
            }`}
          >
            Off
          </Button>
        )}
        {supportedEffortLevels!.map((level) => (
          <Button
            key={level}
            type="button"
            onClick={() => {
              onEffortLevelChange(level);
              onToggle();
            }}
            className={`w-full flex items-center gap-1.5 text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors capitalize last:rounded-b-xl ${
              thinkingMode && effortLevel === level
                ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-700 dark:text-primary-100"
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
            }`}
          >
            <Brain className="size-3" />
            {formatEffortLabel(level)}
          </Button>
        ))}
        {supportsUltracode && variant === "claude" && (
          <Button
            type="button"
            onClick={() => {
              onEffortLevelChange("ultracode");
              onToggle();
            }}
            className={`w-full flex items-center gap-1.5 text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors capitalize last:rounded-b-xl ${
              thinkingMode && effortLevel === "ultracode"
                ? "bg-primary-200/60 dark:bg-primary-200/10"
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800"
            }`}
          >
            <Brain
              className={`size-3 shrink-0 ${
                thinkingMode && effortLevel === "ultracode"
                  ? ULTRACODE_GRADIENT.icon
                  : "text-primary-500 dark:text-primary-400"
              }`}
            />
            <span
              className={
                thinkingMode && effortLevel === "ultracode"
                  ? `font-medium ${ULTRACODE_GRADIENT.text}`
                  : "text-primary-700 dark:text-primary-300"
              }
            >
              {formatEffortLabel("ultracode")}
            </span>
          </Button>
        )}
      </DropdownWrapper>
    </div>
  );
}
