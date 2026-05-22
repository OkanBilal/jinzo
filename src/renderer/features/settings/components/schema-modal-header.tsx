import { Close } from "@/components/ui/icons";
import { Body, Button } from "@/components/ui";

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
        <Body>Structured outputs</Body>
        <div className="relative flex items-center rounded-[10px] bg-primary-200/40 dark:bg-primary-200/5 px-0.25">
          <div
            className="absolute top-0.5 h-[calc(100%-3.5px)] w-[calc(50%-1px)] rounded-[10px] bg-primary-300/40 dark:bg-primary/10 transition-transform duration-200 ease-out"
            style={{
              transform:
                activeTab === "schemas"
                  ? "translateX(0px)"
                  : "translateX(calc(100% + 0px))",
            }}
          />
          <Button
            onClick={() => onTabChange("schemas")}
            className={`relative z-(--z-base) px-1 py-1 text-s rounded-[10px]  transition-colors duration-200 cursor-pointer min-w-18 ${
              activeTab === "schemas" ? activeClass : inactiveClass
            }`}
          >
            Schemas
          </Button>
          <Button
            onClick={() => onTabChange("editor")}
            className={`relative z-(--z-base) px-1 py-1 rounded-[10px] text-s transition-colors duration-200 cursor-pointer min-w-18 ${
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
