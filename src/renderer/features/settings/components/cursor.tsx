import { Heading2, Muted, Toggle, toast, Select } from "@/components/ui";
import { SettingsSection, SettingsRow } from "./settings-layout";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
  useGetSpacesQuery,
  useArchiveSpaceMutation,
  useUnarchiveSpaceMutation,
  useSetActiveSpaceMutation,
} from "@/lib/redux/api";

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

export default function CursorSettings() {
  const {
    data: provider,
    isLoading,
    error,
  } = useGetProviderByIdQuery("cursor");
  const [updateProvider, { isLoading: updating }] = useUpdateProviderMutation();

  const { data: spaces = [] } = useGetSpacesQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [unarchiveSpace] = useUnarchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const cursorSpace = spaces.find((s) => s.slug === "cursor");
  const otherVisibleSpaces = spaces.filter(
    (s) => s.slug !== "cursor" && !s.isArchived,
  );
  const canHide = otherVisibleSpaces.length > 0;

  const config = provider?.config ?? {};
  const mode = (config as any).mode ?? "agent";

  const updateConfig = async (patch: Record<string, unknown>) => {
    if (!provider || updating) return;
    try {
      await updateProvider({
        id: "cursor",
        payload: { config: { ...config, ...patch } },
      }).unwrap();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update setting");
    }
  };

  if (isLoading) {
    return (
      <div>
        <Heading2 className="mb-2">Cursor</Heading2>
        <Muted>Loading...</Muted>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div>
        <Heading2 className="mb-2">Cursor</Heading2>
        <Muted>
          Cursor provider not found. Make sure it is configured in the database.
        </Muted>
      </div>
    );
  }

  return (
    <div className="bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2>Cursor</Heading2>
      </div>

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

      {cursorSpace && (
        <SettingsSection title="Visibility">
          <SettingsRow
            title="Show in Selector"
            description={
              !canHide && !cursorSpace.isArchived
                ? "At least one agent must be active"
                : "Show or hide this agent from the selector"
            }
          >
            <Toggle
              enabled={!cursorSpace.isArchived}
              disabled={!canHide && !cursorSpace.isArchived}
              onChange={async (visible) => {
                try {
                  if (visible) {
                    await unarchiveSpace(cursorSpace.id).unwrap();
                    toast.success("Space is now visible");
                  } else {
                    await archiveSpace(cursorSpace.id).unwrap();
                    const target = otherVisibleSpaces[0];
                    if (target) {
                      await setActiveSpace(target.id).unwrap();
                    }
                    toast.success("Space hidden");
                  }
                } catch (err: any) {
                  toast.error(
                    err?.message || "Failed to update space visibility",
                  );
                }
              }}
            />
          </SettingsRow>
        </SettingsSection>
      )}
    </div>
  );
}
