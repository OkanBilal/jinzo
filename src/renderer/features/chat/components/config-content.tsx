import { Body } from "@/components/ui/text";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import Select from "@/components/ui/select";
import { StopSequenceInput } from "./stop-sequence-input";
import { StructuredOutput } from "./structured-output-toggle";
import { StructuredOutputModal } from "./structured-output-modal";
import { useChatPanelConfig } from "@/features/chat/components/use-chat-panel-config";

export function ConfigContent() {
  const {
    selectedModel,
    thinkingLevel,
    thinkingEnabled,
    useTools,
    displayMode,
    config,
    thinkingConfig,
    isStructuredOutputModalOpen,
    modelOptions,
    toolModeOptions,
    handleTemperatureChange,
    handleTopPChange,
    handleStopSequenceChange,
    handleModelChange,
    handleThinkingLevelChange,
    handleThinkingEnabledChange,
    handleDisplayModeChange,
    handleUseToolsChange,
    setIsStructuredOutputModalOpen,
  } = useChatPanelConfig();

  return (
    <div className="flex-1 overflow-auto noscrollbar p-3">
      <div className="flex items-center justify-between pt-6 pb-4 ">
        <Body className="text-left text-base! font-medium ">Chat Settings</Body>
      </div>
      <div className="flex flex-col gap-3">
        <ConfigSection title="Model">
          <Select
            value={selectedModel}
            options={modelOptions}
            onChange={handleModelChange}
            placeholder="Select model"
          />
        </ConfigSection>
        {thinkingConfig.supportsThinking && (
          <div className="-mt-3">
            <ConfigSection>
              {thinkingConfig.shouldShowThinkingLevel && (
                <Select
                  title="Thinking"
                  value={thinkingLevel}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ]}
                  onChange={handleThinkingLevelChange}
                  placeholder="Select thinking level"
                />
              )}
              {thinkingConfig.shouldShowThinkingToggle && (
                <Toggle
                  enabled={thinkingEnabled}
                  onChange={handleThinkingEnabledChange}
                  label="Enable Thinking"
                />
              )}
            </ConfigSection>
          </div>
        )}
        <ConfigSection title="Interaction Mode">
          <Select
            value={displayMode}
            options={toolModeOptions}
            onChange={handleDisplayModeChange}
            placeholder="Select tool mode"
          />
          {displayMode === "chat" && (
            <div className="mt-4 ">
              <Toggle
                enabled={useTools}
                onChange={handleUseToolsChange}
                label="Enable Tools"
              />
              <StructuredOutput
                onEditClick={() => setIsStructuredOutputModalOpen(true)}
              />
            </div>
          )}
        </ConfigSection>
        <Body className="px-1">Generation</Body>
        <ConfigSection title="Temperature">
          <Slider
            value={config?.temperature ?? 0.7}
            onChange={handleTemperatureChange}
            min={0}
            max={2}
            step={0.01}
            label="Temperature"
            minLabel="Deterministic"
            maxLabel=" Creative"
          />
        </ConfigSection>
        <ConfigSection title="Top P">
          <Slider
            value={config?.top_p ?? 1}
            onChange={handleTopPChange}
            min={0}
            max={1}
            step={0.01}
            label="Top P"
            minLabel="Narrow"
            maxLabel="Expansive"
          />
        </ConfigSection>
        <ConfigSection title="Stop Sequences">
          <StopSequenceInput
            sequences={config?.stop ?? []}
            onChange={handleStopSequenceChange}
          />
        </ConfigSection>
      </div>
      <StructuredOutputModal
        isOpen={isStructuredOutputModalOpen}
        onClose={() => setIsStructuredOutputModalOpen(false)}
      />
    </div>
  );
}

interface ConfigSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function ConfigSection({ title, children }: ConfigSectionProps) {
  return (
    <div className="p-1 ">
      <Body className=" mb-2 ">{title}</Body>
      {children}
    </div>
  );
}
