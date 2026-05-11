import { Select } from "@/components/ui";
import { SettingsSection, SettingsRow } from "./settings-layout";
import {
  ProviderSettingsLayout,
  useProviderSettings,
} from "./provider-settings-shared";
import type { CursorAdapterConfig } from "../../../../shared/adapter.types";
import { CURSOR_MODES } from "@/lib/provider-modes";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";

export default function CursorSettings(
) {
  const {
    provider,
    isLoading,
    error,
    config,
    updateConfig,
  } = useProviderSettings<CursorAdapterConfig>(PROVIDER_IDS.cursor, "cursor");
  const mode = config.mode ?? "agent";

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
            onChange={(value) =>
              updateConfig({ mode: value as CursorAdapterConfig["mode"] })
            }
            options={CURSOR_MODES.map((m) => ({
              value: m.value,
              label: m.label,
              description: m.description,
            }))}
          />
        </SettingsRow>
      </SettingsSection>
    </ProviderSettingsLayout>
  );
}
