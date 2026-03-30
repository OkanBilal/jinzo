import { useMemo } from "react";
import { Button, Heading2, Select, Toggle, toast } from "@/components/ui";
import { useDarkMode } from "../../../hooks/use-dark-mode";
import { useActiveSpace } from "../../../hooks/use-active-space";
import { cn } from "@/lib/cn";
import { defaultTheme } from "@/lib/theme";
import {
  useGetAppSettingsQuery,
  useSetShowToolCallsMutation,
  useSetPreventSleepDuringRunsMutation,
  useSetNotifyOnRunCompleteMutation,
  useSetNotifyOnToolApprovalMutation,
} from "@/lib/redux/api";
import {
  SettingsSection,
  SettingsRow,
  SettingsDivider,
} from "./settings-layout";
import { useAutoUpdate } from "@/hooks/use-auto-update";
import { Refresh } from "@/components/ui/icons";
import { AsciiSpinner } from "@/features/workspace/components/ascii-loader";

type ThemeValue = "light" | "dark" | "system";

function ThemePreviewCard({
  themeValue,
  label,
  isSelected,
  onClick,
  lightBackground,
  darkBackground,
}: {
  themeValue: ThemeValue;
  label: string;
  isSelected: boolean;
  onClick: () => void;
  lightBackground: string;
  darkBackground: string;
}) {
  const isLight = themeValue === "light";
  const isAuto = themeValue === "system";

  const getBackgroundStyle = (bg: string) => {
    if (bg.startsWith("linear-gradient")) {
      return { background: bg };
    }
    return { backgroundColor: bg };
  };

  const lightBgStyle = getBackgroundStyle(lightBackground);
  const darkBgStyle = getBackgroundStyle(darkBackground);

  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 cursor-pointer group active:scale-99 hover:scale-101 duration-200 transition-all",
      )}
    >
      <div
        className={cn(
          "relative w-24 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200",
          isSelected
            ? "border-blue-500 "
            : "border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600",
        )}
      >
        {isAuto ? (
          <div className="w-full h-full flex">
            <div className="w-1/2 h-full flex">
              <div
                className={cn("w-4 h-full flex flex-col p-1 gap-1")}
                style={lightBgStyle}
              >
                <div className="w-2 h-2 bg-primary-950/15 rounded-full" />
                <div className="w-full h-1 bg-primary-950/10 rounded-full mt-1" />
                <div className="w-2/3 h-1 bg-primary-950/10 rounded-full" />
              </div>
              <div className="flex-1 h-full bg-primary-100 flex flex-col p-1.5">
                <div className="flex-1" />
                <div className="w-full h-2 bg-primary-80  rounded-sm border border-primary-950/10" />
              </div>
            </div>
            <div className="w-1/2 h-full flex">
              <div
                className={cn("w-4 h-full flex flex-col p-1 gap-1")}
                style={darkBgStyle}
              >
                <div className="w-2 h-2 bg-primary/20 rounded-full" />
                <div className="w-full h-1 bg-primary/15 rounded-full mt-1" />
                <div className="w-2/3 h-1 bg-primary/15 rounded-full" />
              </div>
              <div className="flex-1 h-full flex bg-primary-950 flex-col p-1.5">
                <div className="flex-1" />
                <div className="w-full h-2 bg-primary/10 rounded-sm flex items-center justify-end pr-0.5"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex">
            <div
              className={cn("w-5 h-full flex flex-col p-1.5 gap-1")}
              style={isLight ? lightBgStyle : darkBgStyle}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isLight ? "bg-primary-950/15" : "bg-primary/20",
                )}
              />
              <div className="flex flex-col gap-0.5 mt-1">
                <div
                  className={cn(
                    "w-full h-1 rounded-full",
                    isLight ? "bg-primary-950/10" : "bg-primary/15",
                  )}
                />
                <div
                  className={cn(
                    "w-4/5 h-1 rounded-full",
                    isLight ? "bg-primary-950/10" : "bg-primary/15",
                  )}
                />
              </div>
            </div>
            <div
              className={`flex-1 h-full flex flex-col p-2 ${isLight ? "bg-primary-100" : "bg-primary-950"}`}
            >
              <div className="flex-1" />
              <div
                className={cn(
                  "w-full h-2 rounded-sm flex items-center px-1",
                  isLight
                    ? "bg-primary/80 border border-primary-950/10"
                    : "bg-primary/10",
                )}
              ></div>
            </div>
          </div>
        )}
      </div>
      <span
        className={cn(
          "text-[13px] font-medium transition-colors",
          isSelected
            ? "text-primary-900 dark:text-primary-100"
            : "text-primary-500 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300",
        )}
      >
        {label}
      </span>
    </Button>
  );
}

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
          <AsciiSpinner variant="null" />
          Downloading...
        </Button>
      );
    case "downloaded":
      return (
        <Button type="button" variant="submit" size="md" onClick={onInstall}>
          Restart &amp; Update
        </Button>
      );
    case "error":
      return (
        <div className="flex flex-col items-end gap-2 max-w-sm">
          <span className="text-xs text-red-400 dark:text-red-400/80 leading-relaxed text-right line-clamp-2">
            {state.error}
          </span>
          <Button type="button" variant="ghost" size="md" onClick={onCheck}>
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
          <Button type="button" variant="ghost" size="md" onClick={onCheck}>
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
            size="md"
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
      useFixedBackground={true}
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
  const { theme, setTheme } = useDarkMode();
  const { activeSpace } = useActiveSpace();
  const {
    state: updateState,
    check: checkUpdate,
    install: installUpdate,
  } = useAutoUpdate();

  const { lightBackground, darkBackground } = useMemo(() => {
    if (!activeSpace?.themeConfig) {
      return {
        lightBackground: defaultTheme.lightBackground.replace(
          /[0-9a-f]{2}$/i,
          "",
        ),
        darkBackground: defaultTheme.darkBackground.replace(
          /[0-9a-f]{2}$/i,
          "",
        ),
      };
    }
    try {
      const config = JSON.parse(activeSpace.themeConfig);
      return {
        lightBackground: config.lightBackground || "#f5f3ee",
        darkBackground: config.darkBackground || "#1a1a1a",
      };
    } catch {
      return {
        lightBackground: "#f5f3ee",
        darkBackground: "#1a1a1a",
      };
    }
  }, [activeSpace?.themeConfig]);

  return (
    <div className="bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2>General</Heading2>
      </div>

      <SettingsSection title="Run">
        <SettingsRow
          title="Run Detail"
          description="Control how much detail is shown in run output"
        >
          <RunDetailSelect />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Prevent Sleep"
          description="Keep your computer awake while a run is active"
        >
          <PreventSleepToggle />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <SettingsRow
          title="Theme"
          description="Choose your preferred color mode"
        >
          <div className="flex gap-4">
            <ThemePreviewCard
              themeValue="light"
              label="Light"
              isSelected={theme === "light"}
              lightBackground={lightBackground}
              darkBackground={darkBackground}
              onClick={() => {
                setTheme("light");
                toast.success("Theme changed to Light");
              }}
            />
            <ThemePreviewCard
              themeValue="system"
              label="Auto"
              isSelected={theme === "system"}
              lightBackground={lightBackground}
              darkBackground={darkBackground}
              onClick={() => {
                setTheme("system");
                toast.success("Theme changed to Auto");
              }}
            />
            <ThemePreviewCard
              themeValue="dark"
              label="Dark"
              isSelected={theme === "dark"}
              lightBackground={lightBackground}
              darkBackground={darkBackground}
              onClick={() => {
                setTheme("dark");
                toast.success("Theme changed to Dark");
              }}
            />
          </div>
        </SettingsRow>
      </SettingsSection>

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
    </div>
  );
}
