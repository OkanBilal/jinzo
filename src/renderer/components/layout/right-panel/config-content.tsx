import { Body } from "@/components/ui/text";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import Select from "@/components/ui/select";
import { StructuredOutputToggle } from "./structured-output-toggle";
import { StructuredOutputModal } from "./structured-output-modal";
import { useRightPanelConfig } from "./use-right-panel-config";

export function ConfigContent() {
  const {
    selectedModel,
    thinkingLevel,
    thinkingEnabled,
    toolMode,
    structuredOutputEnabled,
    structuredOutputSchema,
    config,
    thinkingConfig,
    isStructuredOutputModalOpen,
    modelOptions,
    toolModeOptions,
    handleTemperatureChange,
    handleModelChange,
    handleThinkingLevelChange,
    handleThinkingEnabledChange,
    handleToolModeChange,
    handleStructuredOutputEnabledChange,
    handleStructuredOutputSchemaChange,
    setIsStructuredOutputModalOpen,
  } = useRightPanelConfig();

  return (
    <div className="flex-1 overflow-auto noscrollbar p-3">
      <div className="flex items-center justify-between pt-6 pb-4 ">
        <Body className="text-left text-base! text-primary-900 dark:text-primary font-medium ">
          Configuration
        </Body>
      </div>
      <div className="flex flex-col gap-4">
        <ConfigSection title="Model">
          <Select
            value={selectedModel}
            options={modelOptions}
            onChange={handleModelChange}
            placeholder="Select model"
          />
        </ConfigSection>

        {thinkingConfig.supportsThinking && (
          <ConfigSection title="Thinking">
            {thinkingConfig.shouldShowThinkingLevel && (
              <Select
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
        )}

        <ConfigSection title="Temperature">
          <Slider
            value={config?.temperature ?? 0.7}
            onChange={handleTemperatureChange}
            min={0}
            max={2}
            step={0.01}
            label="Temperature"
            minLabel="More Focused"
            maxLabel="More Creative"
          />
        </ConfigSection>

        <ConfigSection title="Mode">
          <Select
            value={toolMode}
            options={toolModeOptions}
            onChange={handleToolModeChange}
            placeholder="Select tool mode"
          />
          {toolMode !== "mcp" && (
            <StructuredOutputToggle
              enabled={structuredOutputEnabled}
              onChange={handleStructuredOutputEnabledChange}
              onEditClick={() => setIsStructuredOutputModalOpen(true)}
            />
          )}
        </ConfigSection>

        <ConfigSection title="Advanced">
          <Body className="text-primary-900 dark:text-primary! text-sm mb-12">
            Advanced configuration options will appear here.
          </Body>
        </ConfigSection>
      </div>

      <StructuredOutputModal
        isOpen={isStructuredOutputModalOpen}
        onClose={() => setIsStructuredOutputModalOpen(false)}
        schema={structuredOutputSchema}
        onSave={handleStructuredOutputSchemaChange}
      />
    </div>
  );
}

interface ConfigSectionProps {
  title: string;
  children: React.ReactNode;
}

export function ConfigSection({ title, children }: ConfigSectionProps) {
  return (
    <div className="p-1 ">
      <Body className="font-semibold mb-2 text-primary-900 dark:text-primary">
        {title}
      </Body>
      {children}
    </div>
  );
}
