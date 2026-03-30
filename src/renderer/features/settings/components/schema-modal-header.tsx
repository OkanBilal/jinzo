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
        <Text variant="body" className="font-medium text-base!">Structured outputs</Text>
        <div className="relative flex items-center rounded-[10px] glass-morphism bg-primary-950/4 dark:bg-primary/6 px-0.5">
          <div
            className="absolute top-0.5 h-[calc(100%-3.5px)] w-[calc(50%-2px)] rounded-[9px] bg-primary-200/20 dark:bg-primary/8 shadow-sm transition-transform duration-200 ease-out"
            style={{
              transform:
                activeTab === "schemas"
                  ? "translateX(0px)"
                  : "translateX(calc(100% + 0px))",
            }}
          />
          <Button
            onClick={() => onTabChange("schemas")}
            className={`relative z-(--z-base) px-1 py-1 text-[13px] rounded-xl  transition-colors duration-200 cursor-pointer min-w-18 ${
              activeTab === "schemas" ? activeClass : inactiveClass
            }`}
          >
            Schemas
          </Button>
          <Button
            onClick={() => onTabChange("editor")}
            className={`relative z-(--z-base) px-1 py-1 rounded-xl text-[13px] transition-colors duration-200 cursor-pointer min-w-18 ${
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
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
      >
        <Close className="w-4 h-4" />
      </Button>
    </div>
  );
}
