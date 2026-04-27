import { Close } from "@/components/ui/icons";
import { Button, Text } from "@/components/ui";

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
  const activeClass = "text-primary-900 dark:text-primary-100";
  const inactiveClass =
    "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300";

  return (
    <div className="flex items-center justify-between p-6">
      <div className="flex items-center gap-4">
        <Text variant="body" className="font-medium text-base">Structured outputs</Text>
        <div className="relative flex items-center rounded-xl glass-morphism  px-0.25">
          <div
            className="absolute top-0.5 h-[calc(100%-3.5px)] w-[calc(50%-1px)] rounded-[10px] bg-primary-200/20 dark:bg-primary/10 shadow-sm transition-transform duration-200 ease-out"
            style={{
              transform:
                activeTab === "schemas"
                  ? "translateX(0px)"
                  : "translateX(calc(100% + 0px))",
            }}
          />
          <Button
            onClick={() => onTabChange("schemas")}
            className={`relative z-(--z-base) px-1 py-1 text-s rounded-xl  transition-colors duration-200 cursor-pointer min-w-18 ${
              activeTab === "schemas" ? activeClass : inactiveClass
            }`}
          >
            Schemas
          </Button>
          <Button
            onClick={() => onTabChange("editor")}
            className={`relative z-(--z-base) px-1 py-1 rounded-xl text-s transition-colors duration-200 cursor-pointer min-w-18 ${
              activeTab === "editor" ? activeClass : inactiveClass
            }`}
          >
            {editingId ? "Edit" : "New"}
          </Button>
        </div>
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
