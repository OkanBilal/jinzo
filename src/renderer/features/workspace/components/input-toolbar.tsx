import { useState, useRef } from "react";
import { SendButton } from "@/components/ui/input/send-button";
import { DictationButton } from "@/components/ui/input/dictation-button";
import { ModelSelectDropdown } from "@/components/ui/input/model-select-dropdown";
import { Plan } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

interface InputToolbarProps {
  variant: "claude" | "copilot";
  isLoading: boolean;
  onSubmit: () => void;
  onGoalChange: (value: string) => void;
  // Model
  selectedModelDisplayName: string;
  modelDisplayNames: string[];
  onModelChange: (displayName: string) => void;
  isLoadingModels: boolean;
  // Plan mode (Claude only)
  planMode: boolean;
  onPlanModeToggle: () => void;
}

export function InputToolbar({
  variant,
  isLoading,
  onSubmit,
  onGoalChange,
  selectedModelDisplayName,
  modelDisplayNames,
  onModelChange,
  isLoadingModels,
  planMode,
  onPlanModeToggle,
}: InputToolbarProps) {
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const { isRecording, toggle: toggleDictation } = useSpeechRecognition(
    (value) => onGoalChange(value),
  );

  return (
    <div className="flex items-start space-x-2 px-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center relative gap-1">
          <ModelSelectDropdown
            model={selectedModelDisplayName}
            models={modelDisplayNames}
            onModelChange={onModelChange}
            isOpen={showModelDropdown}
            onToggle={() => setShowModelDropdown(!showModelDropdown)}
            onClose={() => setShowModelDropdown(false)}
            dropdownRef={modelDropdownRef}
            openUpward={true}
            variant={variant}
            isLoading={isLoadingModels}
          />
          {variant === "claude" && (
            <Button
              tooltip="Toggle Plan Mode"
              type="button"
              onClick={onPlanModeToggle}
              className={`flex items-center gap-1 -ml-1 px-2.5 py-1 rounded-full text-sm font-medium transition-all cursor-pointer ${
                planMode
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-500"
                  : " text-primary-500 dark:text-primary-300 hover:bg-primary/10"
              }`}
              title={
                planMode
                  ? "Plan mode on — agent will plan before acting"
                  : "Plan mode off — agent acts directly"
              }
            >
              <Plan
                className={`size-3.75 font-medium ${planMode ? "text-amber-600 dark:text-amber-500" : "text-primary-500 dark:text-primary-300"}`}
              />
              Plan
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <DictationButton
            isRecording={isRecording}
            onToggle={toggleDictation}
            variant={variant}
          />
          <SendButton
            loading={isLoading}
            onSubmit={onSubmit}
            variant={variant}
          />
        </div>
      </div>
    </div>
  );
}
