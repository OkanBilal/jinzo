import { useEffect, useRef, useState } from "react";
import { Button, DropdownMenu, DropdownMenuItem } from "@/components/ui";
import { MODE_IDS, providerModes, type ModeId } from "../../../../shared/modes";
import { MODE_CONFIGS } from "@/lib/mode-config";

const MODE_DOT_COLORS: Record<ModeId, string> = {
  developer: "bg-accent",
  work: "bg-warning",
  chat: "bg-success",
};

/**
 * Shape and type shared by the trigger and the static label. The outline is
 * the trigger's alone — an unclickable pill shouldn't wear a control's border.
 */
const MODE_PILL =
  "flex h-7.5 items-center rounded-2xl px-3  text-s font-medium text-primary-900 dark:text-primary-100";

const MODE_OPTIONS = MODE_IDS.map((mode, index) => ({
  mode,
  shortcutKey: String(index + 1),
  shortcutLabel: `⌃ ${index + 1}`,
}));

interface SpaceModePickerProps {
  value: ModeId;
  onChange: (mode: ModeId) => void;
  /**
   * The space's provider. Not every agent drives every experience — a provider
   * with one mode has nothing to pick, so the whole control disappears rather
   * than offering a list of one. Omitted = unrestricted.
   */
  providerId?: string;
}

/**
 * Titlebar dropdown for the active space mode. All three modes remain visible;
 * the current one carries the radio state (so it is what the menu focuses on
 * open, and what a screen reader announces as checked) without a check glyph
 * next to the mode dot. Control+1/2/3 selects Code/Work/Chat.
 */
export function SpaceModePicker({
  value,
  onChange,
  providerId,
}: SpaceModePickerProps) {
  // Shortcut numbers stay tied to the full list (⌃1 is always Code), so a
  // narrowed provider skips its keys rather than renumbering the rest.
  const available = providerId ? providerModes(providerId) : MODE_IDS;
  const options = MODE_OPTIONS.filter(({ mode }) => available.includes(mode));
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
      if (!option || !available.includes(option.mode)) return;

      event.preventDefault();
      setIsOpen(false);
      if (option.mode !== value) onChange(option.mode);
    };

    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [onChange, value, available]);

  // One mode is not a choice — the pill stays, as a label rather than a
  // control, so the titlebar keeps saying which experience is running.
  if (options.length < 2) {
    return <span className={MODE_PILL}>{MODE_CONFIGS[value].label}</span>;
  }

  return (
    <>
      <Button
        ref={triggerRef}
        aria-label={`Current mode: ${MODE_CONFIGS[value].label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={handleTriggerClick}
        className={`${MODE_PILL} glass-outline transition-colors ${
          isOpen
            ? "bg-primary/80 dark:bg-primary/5"
            : "hover:bg-primary/80 dark:hover:bg-primary/5"
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
        {options.map(({ mode, shortcutLabel }) => (
          <DropdownMenuItem
            key={mode}
            className=" py-2 px-4 gap-2"
            selected={mode === value}
            indicator="none"
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
