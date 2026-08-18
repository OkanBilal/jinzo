import { useEffect, useRef, useState } from "react";
import { Button, DropdownMenu, DropdownMenuItem } from "@/components/ui";
import { MODE_IDS, type ModeId } from "../../../../shared/modes";
import { MODE_CONFIGS } from "@/lib/mode-config";

const MODE_DOT_COLORS: Record<ModeId, string> = {
  developer: "bg-accent",
  work: "bg-warning",
  chat: "bg-success",
};

const MODE_OPTIONS = MODE_IDS.map((mode, index) => ({
  mode,
  shortcutKey: String(index + 1),
  shortcutLabel: `⌃ ${index + 1}`,
}));

interface SpaceModePickerProps {
  value: ModeId;
  onChange: (mode: ModeId) => void;
}

/**
 * Titlebar dropdown for the active space mode. All three modes remain visible,
 * the current one is checked, and Control+1/2/3 selects Code/Work/Chat.
 */
export function SpaceModePicker({ value, onChange }: SpaceModePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleTriggerClick = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ x: rect.left, y: rect.bottom + 6 });
    }
    setIsOpen(true);
  };

  const handleModeChange = (mode: ModeId) => {
    setIsOpen(false);
    if (mode !== value) onChange(mode);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        !event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const option = MODE_OPTIONS.find(
        ({ shortcutKey }) => shortcutKey === event.key,
      );
      if (!option) return;

      event.preventDefault();
      setIsOpen(false);
      if (option.mode !== value) onChange(option.mode);
    };

    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [onChange, value]);

  return (
    <>
      <Button
        ref={triggerRef}
        aria-label={`Current mode: ${MODE_CONFIGS[value].label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={handleTriggerClick}
        className={`flex h-8 items-center rounded-2xl px-3 text-s font-medium text-primary-900 glass-outline transition-colors dark:text-primary-100 ${
          isOpen
            ? "bg-primary/80 dark:bg-primary/5"
            : " hover:bg-primary/80  dark:hover:bg-primary/5"
        }`}
      >
        {MODE_CONFIGS[value].label}
      </Button>

      <DropdownMenu
        isOpen={isOpen}
        aria-label="Choose mode"
        position={position}
        onClose={() => setIsOpen(false)}
        minWidth={160}
        origin="top-left"
        initialFocus="selected"
      >
        {MODE_OPTIONS.map(({ mode, shortcutLabel }) => (
          <DropdownMenuItem
            key={mode}
            selected={mode === value}
            className=" py-2 px-4 gap-2"
            onClick={() => handleModeChange(mode)}
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${MODE_DOT_COLORS[mode]}`}
            />
            <span className="flex-1 text-left text-s">
              {MODE_CONFIGS[mode].label}
            </span>
            <span
              aria-hidden="true"
              className=" text-xs  text-primary-600 dark:text-primary-300"
            >
              {shortcutLabel}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenu>
    </>
  );
}
