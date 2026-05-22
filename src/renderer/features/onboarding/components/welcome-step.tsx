import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Caption, Heading3, Toggle, useWizard } from "@/components/ui";
import { ChevronUp } from "@/components/ui/icons";
import { getSpaceDefaultRoute } from "@/lib/route-utils";
import {
  useGetAppSettingsQuery,
  useArchiveSpaceMutation,
  useSetActiveSpaceMutation,
  useSetNotifyOnRunCompleteMutation,
  useSetNotifyOnToolApprovalMutation,
  useDetectInstalledClisQuery,
} from "@/lib/redux/api";
import { ThemePicker } from "@/features/settings/components/theme-picker";
import { type OnboardingAgentSlug } from "../onboarding-agents";
import { AgentCard, AGENT_CHOICES } from "./agent-card";
import { useAgentSpaces } from "../hooks/use-agent-spaces";
import { Tiny } from "@/components/ui/text";

const NOTIFICATION_CHOICES: {
  key: "notifyOnRunComplete" | "notifyOnToolApproval";
  label: string;
}[] = [
  { key: "notifyOnRunComplete", label: "Run complete" },
  { key: "notifyOnToolApproval", label: "Tool approval" },
];

const CLI_AUTO_SELECT_FLAG = "mains:onboarding:cli-auto-select-applied";

export function WelcomeStep() {
  const { goNext } = useWizard();
  const navigate = useNavigate();
  const { data: appSettings } = useGetAppSettingsQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const [setNotifyOnRunComplete] = useSetNotifyOnRunCompleteMutation();
  const [setNotifyOnToolApproval] = useSetNotifyOnToolApprovalMutation();
  const { data: detectedClis } = useDetectInstalledClisQuery();
  const hasAppliedAutoSelect = useRef(false);

  const { agentSpaces, visibleAgentCount, spacesBySlug, toggleAgent } =
    useAgentSpaces();

  useEffect(() => {
    if (hasAppliedAutoSelect.current) return;
    if (!detectedClis) return;
    if (agentSpaces.length === 0) return;
    if (localStorage.getItem(CLI_AUTO_SELECT_FLAG) === "1") return;

    const installedSpaces = agentSpaces.filter(
      (s) => detectedClis[s.slug as OnboardingAgentSlug],
    );

    hasAppliedAutoSelect.current = true;
    localStorage.setItem(CLI_AUTO_SELECT_FLAG, "1");

    if (installedSpaces.length === 0) {
      // Detection found nothing — likely PATH issue. Leave defaults alone.
      return;
    }

    const notInstalledVisible = agentSpaces.filter(
      (s) => !s.isArchived && !detectedClis[s.slug as OnboardingAgentSlug],
    );

    const activeId = appSettings?.activeSpaceId ?? null;
    const activeWillBeArchived = notInstalledVisible.some(
      (s) => s.id === activeId,
    );

    void (async () => {
      if (activeWillBeArchived) {
        const nextActive = installedSpaces
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)[0];
        try {
          await setActiveSpace(nextActive.id).unwrap();
          const route = getSpaceDefaultRoute(nextActive);
          setTimeout(() => navigate(route, { replace: true }), 0);
        } catch {
          // ignore
        }
      }
      for (const space of notInstalledVisible) {
        try {
          await archiveSpace(space.id).unwrap();
        } catch {
          // ignore — best-effort pre-selection
        }
      }
    })();
  }, [
    agentSpaces,
    detectedClis,
    appSettings?.activeSpaceId,
    archiveSpace,
    setActiveSpace,
    navigate,
  ]);

  return (
    <div className="space-y-4 -mt-8">
      <div className="space-y-1 ">
        <Heading3>
          Welcome to Mains
        </Heading3>
        <Caption className="leading-relaxed">
          Your AI-powered workspace where ideas rise like mountains and flow
          like water.
        </Caption>
      </div>


      <div className="space-y-2 mt-8">
        <div className="flex items-baseline justify-between">
          <Tiny>
            Theme
          </Tiny>
        </div>
        <div className="flex justify-center w-full">
          <ThemePicker size="lg" />
        </div>
      </div>

      <div className="space-y-2 mt-8">
        <div className="flex items-baseline justify-between">
          <Tiny>
            Pick your agents
          </Tiny>

        </div>
        <div className="flex gap-3">
          {AGENT_CHOICES.map(({ slug, label, Icon }) => {
            const space = spacesBySlug.get(slug);
            const isSelected = !!space && !space.isArchived;
            const cannotArchiveLast =
              isSelected && visibleAgentCount <= 1;
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
      </div>

      <div className="space-y-2 mt-8 mb-8">
        <div className="flex items-baseline justify-between">
          <Tiny>
            Notifications
          </Tiny>

        </div>
        <div className="space-y-1">
          {NOTIFICATION_CHOICES.map(({ key, label }) => {
            const enabled = appSettings?.[key] ?? true;
            const handleChange = (next: boolean) => {
              if (key === "notifyOnRunComplete") {
                setNotifyOnRunComplete(next);
              } else {
                setNotifyOnToolApproval(next);
              }
            };
            return (
              <Toggle
                key={key}
                label={label}
                enabled={enabled}
                onChange={handleChange}
              />
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          variant="bare"
          onClick={goNext}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-900 dark:text-primary-100 hover:opacity-70 transition-opacity"
        >
          Continue
          <ChevronUp className="w-4 h-4 rotate-90" />
        </Button>
      </div>
    </div>
  );
}
