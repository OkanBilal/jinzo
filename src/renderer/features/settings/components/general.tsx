import { Button, Select, Toggle, toast } from "@/components/ui";
import {
  useGetAppSettingsQuery,
  useSetShowToolCallsMutation,
  useSetPreventSleepDuringRunsMutation,
  useSetNotifyOnRunCompleteMutation,
  useSetNotifyOnToolApprovalMutation,
  useSetShowMenuBarIconMutation,
} from "@/lib/redux/api";
import {
  SettingsPageShell,
  SettingsSection,
  SettingsRow,
  SettingsDivider,
} from "./settings-layout";
import { ThemePicker, ThemeSelect, type ThemeValue } from "./theme-picker";
import { useAutoUpdate } from "@/hooks/use-auto-update";
import { useCapabilities, useIsMobile } from "@/lib/platform";
import { Refresh } from "@/components/ui/icons";
import { AsciiSpinner } from "@/components/ui/ascii-spinner";
import {
  AgentCard,
  AGENT_CHOICES,
} from "@/features/onboarding/components/agent-card";
import { useAgentSpaces } from "@/features/onboarding/hooks/use-agent-spaces";

function UpdateButton({
  state,
  onCheck,
  onInstall,
}: {
  state: { status: string; info: any; progress: any; error: string | null };
  onCheck: () => void;
  onInstall: () => void;
}) {
  switch (state.status) {
    case "checking":
      return (
        <Button type="button" variant="ghost" disabled isLoading>
          Checking...
        </Button>
      );
    case "available":
    case "downloading":
      return (
        <Button
          type="button"
          variant="ghost"
          disabled
          className="flex items-center gap-1"
        >
          <AsciiSpinner variant="null" kind="download" />
          Downloading...
        </Button>
      );
    case "downloaded":
      return (
        <Button type="button" variant="submit" onClick={onInstall}>
          Restart &amp; Update
        </Button>
      );
    case "error":
      return (
        <div className="flex items-center gap-3">
          <span className="text-xs text-danger dark:text-danger/80 leading-relaxed text-right line-clamp-2 max-w-48">
            {state.error}
          </span>
          <Button type="button" variant="ghost" onClick={onCheck}>
            Retry
          </Button>
        </div>
      );
    case "not-available":
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary-500 dark:text-primary-400">
            Up to date
          </span>
          <Button type="button" variant="ghost" onClick={onCheck}>
            Check Again
          </Button>
        </div>
      );
    default:
      return (
        <div className="">
          <Button
            className="flex"
            type="button"
            variant="primary"
            onClick={onCheck}
          >
            <Refresh className="w-4 h-4 mr-1" />
            Check for Updates
          </Button>
        </div>
      );
  }
}

const RUN_DETAIL_OPTIONS = [
  {
    value: "steps_with_tool_calls",
    label: "Steps with tool calls",
    description: "Show tool calls with outputs",
  },
  {
    value: "steps",
    label: "Steps",
    description: "Hide tool calls and outputs",
  },
];

function RunDetailSelect() {
  const { data: settings } = useGetAppSettingsQuery();
  const [setShowToolCalls] = useSetShowToolCallsMutation();

  const value =
    settings?.showToolCalls !== false ? "steps_with_tool_calls" : "steps";

  return (
    <Select
      value={value}
      options={RUN_DETAIL_OPTIONS}
      onChange={(val) => {
        setShowToolCalls(val === "steps_with_tool_calls");
      }}
      placeholder="Select detail level"
    />
  );
}

function PreventSleepToggle() {
  const { data: settings } = useGetAppSettingsQuery();
  const [setPreventSleep] = useSetPreventSleepDuringRunsMutation();

  return (
    <Toggle
      enabled={settings?.preventSleepDuringRuns ?? false}
      onChange={(val) => setPreventSleep(val)}
    />
  );
}

function NotifyRunCompleteToggle() {
  const { data: settings } = useGetAppSettingsQuery();
  const [setNotifyOnRunComplete] = useSetNotifyOnRunCompleteMutation();

  return (
    <Toggle
      enabled={settings?.notifyOnRunComplete ?? true}
      onChange={(val) => setNotifyOnRunComplete(val)}
    />
  );
}

function MenuBarIconToggle() {
  const { data: settings } = useGetAppSettingsQuery();
  const [setShowMenuBarIcon] = useSetShowMenuBarIconMutation();

  return (
    <Toggle
      enabled={settings?.showMenuBarIcon ?? true}
      onChange={async (val) => {
        await setShowMenuBarIcon(val);
        await window.api.app.setMenuBarIconVisible(val);
      }}
    />
  );
}

function AgentsSection() {
  const { visibleAgentCount, spacesBySlug, toggleAgent } = useAgentSpaces({
    navigateOnSwitch: false,
  });

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      {AGENT_CHOICES.map(({ slug, label, Icon }) => {
        const space = spacesBySlug.get(slug);
        const isSelected = !!space && !space.isArchived;
        const cannotArchiveLast = isSelected && visibleAgentCount <= 1;
        return (
          <AgentCard
            key={slug}
            label={label}
            Icon={Icon}
            isSelected={isSelected}
            disabled={!space || cannotArchiveLast}
            onClick={() => toggleAgent(slug)}
          />
        );
      })}
    </div>
  );
}

function NotifyToolApprovalToggle() {
  const { data: settings } = useGetAppSettingsQuery();
  const [setNotifyOnToolApproval] = useSetNotifyOnToolApprovalMutation();

  return (
    <Toggle
      enabled={settings?.notifyOnToolApproval ?? true}
      onChange={(val) => setNotifyOnToolApproval(val)}
    />
  );
}

export default function GeneralSettings() {
  const {
    state: updateState,
    check: checkUpdate,
    install: installUpdate,
  } = useAutoUpdate();
  const caps = useCapabilities();
  const isMobile = useIsMobile();

  const handleThemeChange = (value: ThemeValue) => {
    const labelMap = { light: "Light", system: "Auto", dark: "Dark" };
    toast.success(`Theme changed to ${labelMap[value]}`);
  };

  return (
    <SettingsPageShell title="General">
      <SettingsSection title="Run">
        <SettingsRow
          title="Run Detail"
          description="Control how much detail is shown in run output"
        >
          <RunDetailSelect />
        </SettingsRow>
        {caps.preventSleep && (
          <>
            <SettingsDivider />
            <SettingsRow
              title="Prevent Sleep"
              description="Keep your computer awake while a run is active"
            >
              <PreventSleepToggle />
            </SettingsRow>
          </>
        )}
      </SettingsSection>

      <SettingsSection title="Appearance">
        <SettingsRow
          title="Theme"
          description="Choose your preferred color mode"
        >
          {isMobile ? (
            <ThemeSelect onChange={handleThemeChange} />
          ) : (
            <ThemePicker onChange={handleThemeChange} />
          )}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Agents">
        <SettingsRow
          title="Active agents"
          description="Enable or disable agent runtimes"
        >
          <AgentsSection />
        </SettingsRow>
      </SettingsSection>

      {caps.windowChrome && (
        <SettingsSection title="Menu Bar">
          <SettingsRow
            title="Menu Bar Icon"
            description="Show the Mains icon in the system menu bar"
          >
            <MenuBarIconToggle />
          </SettingsRow>
        </SettingsSection>
      )}

      {caps.nativeNotifications && (
        <SettingsSection title="Notifications">
          <SettingsRow
            title="Run Complete"
            description="Get notified when a run finishes"
          >
            <NotifyRunCompleteToggle />
          </SettingsRow>
          <SettingsDivider />
          <SettingsRow
            title="Tool Approval"
            description="Get notified when a tool needs your approval"
          >
            <NotifyToolApprovalToggle />
          </SettingsRow>
        </SettingsSection>
      )}

      {caps.autoUpdate && (
        <SettingsSection title="Software Updates">
          <SettingsRow
            title="Version"
            description={`Current version: v${__APP_VERSION__ ?? "1.0.0"}`}
          >
            <UpdateButton
              state={updateState}
              onCheck={checkUpdate}
              onInstall={installUpdate}
            />
          </SettingsRow>
        </SettingsSection>
      )}
    </SettingsPageShell>
  );
}
