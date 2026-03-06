import { RefObject } from "react";
import { Button } from "@/components/ui/button";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import { useClickOutside } from "@/hooks/use-click-outside";
import { getModelIcon } from "@/lib/model-icons";
import { ModelLoader } from "@/components/ui/input/model-loader";

interface ModelSelectDropdownProps {
  model: string;
  models: string[];
  onModelChange: (model: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  isLoading?: boolean;
}

function formatClaudeModelName(model: string): string {
  const lowerModel = model.toLowerCase();

  if (
    lowerModel === "default (recommended)" ||
    lowerModel === "default" ||
    lowerModel === "opus"
  ) {
    return "Claude Opus 4.6";
  }
  if (lowerModel === "sonnet") {
    return "Claude Sonnet 4.6";
  }
  if (lowerModel === "haiku") {
    return "Claude Haiku 4.5";
  }

  return model;
}

export function ModelSelectDropdown({
  model,
  models,
  onModelChange,
  isOpen,
  onToggle,
  onClose,
  dropdownRef,
  openUpward = false,
  isLoading = false,
}: ModelSelectDropdownProps) {
  const modelList = Array.isArray(models) ? models : [];
  const displayModel = formatClaudeModelName(model);

  useClickOutside(dropdownRef, () => {
    if (isOpen && onClose) {
      onClose();
    }
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="flex cursor-pointer items-center hover:bg-primary-200/30 dark:hover:bg-primary-600/20 transition-colors rounded-3xl"
      >
        <Button
          tooltip="Select model"
          tooltipPosition="top"
          type="button"
          onClick={onToggle}
          className="text-sm cursor-pointer text-primary-700 dark:text-primary-300/80 font-medium px-2 py-1.5 flex items-center gap-1.5"
          aria-haspopup="true"
          aria-expanded={isOpen}
          disabled={isLoading && !displayModel}
        >
          {isLoading && !displayModel ? (
            <ModelLoader />
          ) : (
            <>
              {getModelIcon(displayModel)}
              {displayModel}
            </>
          )}
        </Button>
      </div>

      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        minWidth="min-w-52"
        useFixedBackground={true}
      >
        <div className="max-h-80 overflow-auto noscrollbar">
          {modelList.map((m) => {
            const displayName = formatClaudeModelName(m);
            return (
              <Button
                key={m}
                type="button"
                onClick={() => {
                  onModelChange(m);
                  onToggle();
                }}
                className={`w-full text-left px-3 py-2.5 cursor-pointer text-sm transition-colors flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl ${
                  model === m ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-700 dark:text-primary-300 font-medium" : "hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-300"
                }`}
              >
                {getModelIcon(displayName)}
                {displayName}
              </Button>
            );
          })}
        </div>
      </DropdownWrapper>
    </div>
  );
}
