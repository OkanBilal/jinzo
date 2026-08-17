import { SegmentedTabs, type SegmentedTabOption } from "@/components/ui";
import { MODE_IDS, type ModeId } from "../../../../shared/modes";
import { MODE_CONFIGS } from "@/lib/mode-config";

const MODE_OPTIONS: ReadonlyArray<SegmentedTabOption<ModeId>> = MODE_IDS.map(
  (mode) => ({ value: mode, label: MODE_CONFIGS[mode].label }),
);

interface SpaceModePickerProps {
  value: ModeId;
  onChange: (mode: ModeId) => void;
}

/**
 * Mode selector for the active space (developer / work / chat). Sibling of
 * SpaceThemePicker — both live in the space customizer and persist onto the
 * space row. Changing mode reshapes the agent's instructions (work adds a
 * non-technical delta) and, over time, the UI shape (see MODE_CONFIGS).
 */
export function SpaceModePicker({ value, onChange }: SpaceModePickerProps) {
  return (
    <SegmentedTabs
      value={value}
      onChange={onChange}
      options={MODE_OPTIONS}
      variant="pill"
      aria-label="Space mode"
    />
  );
}
