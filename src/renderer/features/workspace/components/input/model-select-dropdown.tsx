import { Button } from "@/components/ui/button";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import { DeepSeek, Gemini, Gpt, Meta } from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/mood";
import { useClickOutside } from "@/hooks/use-click-outside";
import { RefObject } from "react";

function getModelIcon(modelName: string) {
  if (modelName.includes("deepseek")) {
    return <DeepSeek className="w-4 h-4 " />;
  }
  if (modelName.includes("gpt") || modelName.includes("GPT")) {
    return <Gpt className="w-4 h-4 " />;
  }
  if (modelName.includes("llama")) {
    return <Meta className="w-4 h-4 " />;
  }
  if (modelName.includes("gemma")) {
    return <span className="text-base">💎</span>;
  }
  if (modelName.includes("mistral")) {
    return <span className="text-base">🌀</span>;
  }
  if (modelName.includes("qwen")) {
    return <span className="text-base">🌐</span>;
  }
  if (modelName.includes("Claude") || modelName.includes("claude")) {
    return <Claude className="w-4 h-4 " />;
  }
  if (modelName.includes("Opus")) {
    return <Claude className="w-4 h-4 " />;
  }
  if (modelName.includes("Gemini")) {
    return <Gemini className="w-4 h-4 " />;
  }
  // Default icon
  return <span className="text-base">⚡</span>;
}

export default function ModelSelectDropdown({
  model,
  models,
  onModelChange,
  isOpen,
  onToggle,
  onClose,
  dropdownRef,
  openUpward = false,
}: ModelSelectDropdownProps) {
  const modelList = Array.isArray(models) ? models : [];

  // Close dropdown when clicking outside
  useClickOutside(dropdownRef, () => {
    if (isOpen) {
      onClose();
    }
  });

  return (
    <div className=" relative" ref={dropdownRef}>
      <div className="flex cursor-pointer items-center hover:bg-copilot-blue/30 dark:hover:bg-copilot-lightblue/10 transition-colors rounded-3xl">
        <Button
          tooltip="Select model"
          tooltipPosition="top"
          type="button"
          onClick={onToggle}
          className="text-sm cursor-pointer text-copilot-blue dark:text-copilot-lightblue/80 font-medium px-2 py-1.5 flex items-center gap-1.5"
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
                model === m
                  ? "bg-copilot-lightblue/60 dark:bg-copilot-lightblue/8 text-copilot-blue dark:text-copilot-lightblue font-medium"
                  : "hover:bg-copilot-lightblue/50 dark:hover:bg-copilot-lightblue/6 text-copilot-blue dark:text-copilot-lightblue"
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

export interface ModelSelectDropdownProps {
  model: string;
  models: string[];
  onModelChange: (model: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
}
