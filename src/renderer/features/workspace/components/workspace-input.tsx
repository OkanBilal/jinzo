import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Brain } from "@/components/ui/icons";
import InputForm from "@/features/chat/components/input/input-form";
import ModelSelectDropdown from "@/features/chat/components/input/model-select-dropdown";
import DictationButton from "@/features/chat/components/input/dictation-button";
import SendButton from "@/features/chat/components/input/send-button";
import { useSpeechRecognition } from "@/features/chat/hooks";
import type { Run } from "../types";

interface WorkspaceInputProps {
  goal: string;
  onGoalChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  activeRun: Run | undefined;
  canResume?: boolean;
}

const MODELS = ["Sonnet 4.5", "Opus 4.5"];

export function WorkspaceInput({
  goal,
  onGoalChange,
  onSubmit,
  isLoading,
  activeRun,
  canResume = false,
}: WorkspaceInputProps) {
  const location = useLocation();
  const isClaudeRoute = location.pathname.includes("claude");
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState("Claude Opus 4.5");
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const { isRecording, toggle: toggleDictation } = useSpeechRecognition(
    (value) => onGoalChange(value),
  );

  return (
    <div
      className={`w-200 mb-8 mx-auto flex flex-col pb-2 rounded-3xl ${isClaudeRoute ? "glass-morphism-claude" : "glass-morphism-copilot"}
        cursor-pointer transition-all`}
    >
      <div className="relative">
        <InputForm
          query={goal}
          onQueryChange={onGoalChange}
          onSubmit={onSubmit}
          placeholder={
            canResume
              ? "Ask to make changes, @mention files, run /commands"
              : "Ask to make changes, @mention files, run /commands"
          }
        />
      </div>
      <div className="flex items-start space-x-2 px-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center relative">
            <ModelSelectDropdown
              model={selectedModel}
              models={MODELS}
              onModelChange={setSelectedModel}
              isOpen={showModelDropdown}
              onToggle={() => setShowModelDropdown(!showModelDropdown)}
              dropdownRef={modelDropdownRef}
              openUpward={true}
            />
            <button
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              className={`p-1.5 rounded-lg transition-colors ${
                thinkingEnabled
                  ? "text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
                  : "text-primary-500 hover:text-primary-300 hover:bg-primary-800/50"
              }`}
              title={
                thinkingEnabled
                  ? "Extended thinking enabled"
                  : "Enable extended thinking"
              }
              disabled={isLoading || activeRun?.status === "running"}
            >
              <Brain className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <DictationButton isRecording={isRecording} onToggle={toggleDictation} />
          <SendButton loading={isLoading} onSubmit={onSubmit} />
        </div>
      </div>
    </div>
  );
}
