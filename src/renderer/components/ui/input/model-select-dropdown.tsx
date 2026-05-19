import { RefObject } from "react";
import { Button } from "../button";
import DropdownWrapper from "../dropdown-wrapper";
import { useClickOutside } from "@/hooks/use-click-outside";
import { formatModelDisplayName, getModelIcon } from "@/lib/model-icons";
import { ModelLoader } from "./model-loader";
import { ArrowUp } from "../icons";

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
  variant?: "claude" | "copilot" | "codex" | "cursor";
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
  variant,
}: ModelSelectDropdownProps) {
  const modelList = (Array.isArray(models) ? models : []).filter(
    (m) => !(variant === "cursor" && m.toLowerCase() === "default"),
  );
  const noModels = !isLoading && modelList.length === 0;
  const displayModel = formatModelDisplayName(model, variant);

  useClickOutside(dropdownRef, () => {
    if (isOpen && onClose) {
      onClose();
    }
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex cursor-pointer items-center hover:bg-primary-200/30 animate-blur-reveal dark:hover:bg-primary-800 transition-colors rounded-2xl">
        <Button
          tooltip={noModels ? "No models available" : "Select model"}
          tooltipPosition="top"
          type="button"
          onClick={noModels ? undefined : onToggle}
          className={`text-sm  px-2 py-1 flex items-center gap-1.5 ${
            noModels
              ? "text-primary-400 dark:text-primary-600 cursor-not-allowed"
              : "cursor-pointer text-primary-700 dark:text-primary-300"
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          disabled={noModels || (isLoading && !displayModel)}
        >
          {isLoading && !displayModel ? (
            <ModelLoader />
          ) : noModels ? (
            <span>No models found</span>
          ) : (
            <>
              {getModelIcon(displayModel, variant)}
              {displayModel}
              <ArrowUp className={`size-3.5 rotate-180 `} />
            </>
          )}
        </Button>
      </div>

      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        minWidth="min-w-48"
        useFixedBackground={true}
      >
        <div className="max-h-80 overflow-auto noscrollbar ">
          {modelList.map((m) => {
            const displayName = formatModelDisplayName(m, variant);
            return (
              <Button
                key={m}
                type="button"
                onClick={() => {
                  onModelChange(m);
                  onToggle();
                }}
                className={`w-full text-left px-2.5 py-2 cursor-pointer text-sm transition-colors flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl ${
                  model === m
                    ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-700 dark:text-primary-300 "
                    : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
                }`}
              >
                {getModelIcon(displayName, variant)}
                {displayName}
              </Button>
            );
          })}
        </div>
      </DropdownWrapper>
    </div>
  );
}
