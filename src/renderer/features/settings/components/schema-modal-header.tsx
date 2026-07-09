import { Close } from "@/components/ui/icons";
import { Body, Button, SegmentedTabs } from "@/components/ui";

type Tab = "schemas" | "editor";

interface SchemaModalHeaderProps {
  activeTab: Tab;
  editingId: string | null;
  onTabChange: (tab: Tab) => void;
  onClose: () => void;
}

export function SchemaModalHeader({
  activeTab,
  editingId,
  onTabChange,
  onClose,
}: SchemaModalHeaderProps) {
  return (
    <div className="flex items-center justify-between p-6">
      <div className="flex items-center gap-4">
        <Body>Structured outputs</Body>
        <SegmentedTabs
          value={activeTab}
          onChange={onTabChange}
          options={[
            { value: "schemas", label: "Schemas" },
            { value: "editor", label: editingId ? "Edit" : "New" },
          ]}
          className="min-w-37"
        />
      </div>
      <Button
        onClick={onClose}
        aria-label="Close modal"
        className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer hover:bg-primary-100/80 dark:hover:bg-primary/10 p-1 text-primary-900 dark:text-primary-300 transition-all duration-300 ease-out"
      >
        <Close className="w-4 h-4" />
      </Button>
    </div>
  );
}
