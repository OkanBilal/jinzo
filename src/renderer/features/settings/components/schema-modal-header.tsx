import { Close } from "@/components/ui/icons";
import { Heading3 } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

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
        <Heading3>Structured outputs</Heading3>
        <div className="relative flex items-center rounded-xl bg-primary-950/4 dark:bg-primary/6 p-0.5">
          <div
            className="absolute top-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-[11px] bg-primary dark:bg-primary-800 shadow-sm transition-transform duration-200 ease-out"
            style={{
              transform:
                activeTab === "schemas"
                  ? "translateX(0px)"
                  : "translateX(calc(100% + 0px))",
            }}
          />
          <Button
            onClick={() => onTabChange("schemas")}
            className={`relative z-10 px-3 py-1.5 rounded-xl text-sm transition-colors duration-200 cursor-pointer min-w-20 ${
              activeTab === "schemas" ? activeClass : inactiveClass
            }`}
          >
            Schemas
          </Button>
          <Button
            onClick={() => onTabChange("editor")}
            className={`relative z-10 px-3 py-1.5 rounded-xl text-sm transition-colors duration-200 cursor-pointer min-w-20 ${
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
