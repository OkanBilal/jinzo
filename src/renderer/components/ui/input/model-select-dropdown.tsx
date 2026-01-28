import { RefObject } from "react";
import { Button } from "@/components/ui/button";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { InputVariant } from "./send-button";
import { getModelIcon } from "@/lib/model-icons";

interface ModelSelectDropdownProps {
  model: string;
  models: string[];
  onModelChange: (model: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  variant?: InputVariant;
}

const variantStyles = {
  default: {
    container: "hover:bg-primary-200/30 dark:hover:bg-primary-700/40",
    button: "text-primary-700 dark:text-primary-400",
    selected:
      "bg-primary-200/60 dark:bg-primary-800/50 text-primary-900 dark:text-primary-100",
    item: "hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-100",
  },
  copilot: {
    container: "hover:bg-copilot-blue/10 dark:hover:bg-copilot-lightblue/10",
    button: "text-copilot-blue dark:text-copilot-lightblue/80",
    selected:
      "bg-copilot-lightblue/60 dark:bg-copilot-lightblue/8 text-copilot-blue dark:text-copilot-lightblue",
    item: "hover:bg-copilot-lightblue/50 dark:hover:bg-copilot-lightblue/6 text-copilot-blue dark:text-copilot-lightblue",
  },
};

export function ModelSelectDropdown({
  model,
  models,
  onModelChange,
  isOpen,
  onToggle,
  onClose,
  dropdownRef,
  openUpward = false,
  variant = "default",
}: ModelSelectDropdownProps) {
  const modelList = Array.isArray(models) ? models : [];
  const styles = variantStyles[variant];

  useClickOutside(dropdownRef, () => {
    if (isOpen && onClose) {
      onClose();
    }
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`flex cursor-pointer items-center ${styles.container} transition-colors rounded-3xl`}
      >
        <Button
          tooltip="Select model"
          tooltipPosition="top"
          type="button"
          onClick={onToggle}
          className={`text-sm cursor-pointer ${styles.button} font-medium px-2 py-1.5 flex items-center gap-1.5`}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          {getModelIcon(model)}
          {model}
        </Button>
      </div>

      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        minWidth="min-w-52"
        useFixedBackground={true}
      >
        <div className="max-h-80 overflow-auto">
          {modelList.map((m) => (
            <Button
              key={m}
              type="button"
              onClick={() => {
                onModelChange(m);
                onToggle();
              }}
              className={`w-full text-left px-4 py-3 cursor-pointer text-sm transition-colors flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl ${
                model === m ? `${styles.selected} font-medium` : styles.item
              }`}
            >
              {getModelIcon(m)}
              {m}
            </Button>
          ))}
        </div>
      </DropdownWrapper>
    </div>
  );
}
