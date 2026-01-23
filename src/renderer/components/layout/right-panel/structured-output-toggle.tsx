import { Button } from "@/components/ui/button";
import { Body } from "@/components/ui/text";

interface StructuredOutputToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  onEditClick: () => void;
}

export function StructuredOutputToggle({
  enabled,
  onChange,
  onEditClick,
}: StructuredOutputToggleProps) {
  return (
    <div className="flex items-center justify-between p-1 mt-2">
      <div className="flex flex-col">
        <Body className="text-sm text-primary-800 dark:text-primary-200">
          Structured Outputs
        </Body>
      </div>
      <div className="flex items-center gap-2">
        {enabled && (
          <Button
            onClick={onEditClick}
            className="px-2.5 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 bg-black/4 dark:bg-white/6 rounded-lg hover:bg-black/6 dark:hover:bg-white/8 transition-colors"
          >
            Edit
          </Button>
        )}
        <Button
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all shadow-[inset_0_0.5px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0.5px_2px_rgba(0,0,0,0.3)] ${
            enabled
              ? "bg-blue-500 dark:bg-blue-600"
              : "bg-black/8 dark:bg-white/15"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </Button>
      </div>
    </div>
  );
}
