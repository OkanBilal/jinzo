import { Button } from "@/components/ui";

interface ProjectSaveBarProps {
  lastSavedLabel: string | null;
  isDirty: boolean;
  saving: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onSave: () => void;
}

export function ProjectSaveBar({ lastSavedLabel, isDirty, saving, isLoading, onRefresh, onSave }: ProjectSaveBarProps) {
  return (
    <div className="flex items-center justify-between pt-2 mb-8">
      <div className="text-xs text-primary-600 dark:text-primary-400">
        {lastSavedLabel ? `Last saved: ${lastSavedLabel}` : "Not saved yet"}
      </div>
      <div className="flex items-center gap-3">
        <Button
          tooltip="Refresh project details"
          type="button"
          variant="ghost"
          onClick={onRefresh}
          disabled={isLoading || saving}
        >
          Refresh
        </Button>
        <Button
          type="button"
          variant="submit"
          disabled={!isDirty || saving}
          isLoading={saving}
          onClick={onSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
