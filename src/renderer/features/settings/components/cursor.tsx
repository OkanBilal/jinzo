import { Select } from "@/components/ui";
import { SettingsSection, SettingsRow } from "./settings-layout";
import {
  ProviderSettingsLayout,
  useProviderSettings,
} from "./provider-settings-shared";

const MODE_OPTIONS = [
  {
    value: "ask",
    label: "Ask",
    description: "Answer questions without taking action",
  },
  {
    value: "agent",
    label: "Agent",
    description: "Full autonomous agent mode",
  },
  {
    value: "plan",
    label: "Plan",
    description: "Plan before executing",
  },
];

export default function CursorSettings(
) {
  const {
    provider,
    isLoading,
    error,
    config,
    updateConfig,
  } = useProviderSettings("cursor", "cursor");
  const mode = (config as any).mode ?? "agent";

  return (
    <ProviderSettingsLayout
      title="Cursor"
      provider={provider}
      isLoading={isLoading}
      error={error}
    >
      <SettingsSection title="Configuration">
        <SettingsRow title="Mode" description="How Cursor operates during runs">
          <Select
            useFixedBackground
            value={mode}
            onChange={(value) => updateConfig({ mode: value })}
            options={MODE_OPTIONS}
          />
        </SettingsRow>
      </SettingsSection>
    </ProviderSettingsLayout>
  );
}
