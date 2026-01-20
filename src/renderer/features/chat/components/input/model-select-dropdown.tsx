import DropdownWrapper from "../../../../components/ui/dropdown-wrapper";

import { ModelSelectDropdownProps } from "./types";
import { DeepSeek, Gpt, Meta } from "../../../../components/ui/icons";

function getModelIcon(modelName: string) {
  if (modelName.includes("deepseek")) {
    return <DeepSeek className="w-4 h-4 " />;
  }
  if (modelName.includes("gpt")) {
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
  // Default icon
  return <span className="text-base">⚡</span>;
}

export default function ModelSelectDropdown({
  model,
  models,
  onModelChange,
  isOpen,
  onToggle,
  dropdownRef,
  openUpward = false,
}: ModelSelectDropdownProps) {
  const modelList = Array.isArray(models) ? models : [];
  
  return (
    <div className=" relative" ref={dropdownRef}>
      <div className="flex cursor-pointer items-center  hover:bg-primary-200/60 dark:hover:bg-primary-700/40 transition-colors rounded-3xl">
        <button
          type="button"
          onClick={onToggle}
          className="text-sm cursor-pointer text-primary-700 dark:text-primary-400 font-medium px-2 py-1.5 flex items-center gap-1.5"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          {getModelIcon(model)}
          {model}
        </button>
      </div>

      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        minWidth="min-w-48"
        useFixedBackground={true}
      >
        <div className="max-h-80 overflow-auto">
          {modelList.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onModelChange(m);
                onToggle();
              }}
              className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl ${
                model === m
                  ? "bg-primary-200 dark:bg-primary-800/50 text-primary-900 dark:text-primary-100 font-medium"
                  : "hover:bg-primary-100 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-100"
              }`}
            >
              {getModelIcon(m)}
              {m}
            </button>
          ))}
        </div>
      </DropdownWrapper>
    </div>
  );
}
