import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Toggle, useWizard } from "@/components/ui";
import { Check, ChevronUp, Plus } from "@/components/ui/icons";
import { Codex, CopilotStatic, Cursor } from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/space";
import { cn } from "@/lib/cn";
import { getSpaceDefaultRoute } from "@/lib/route-utils";
import {
  useGetSpacesQuery,
  useGetAppSettingsQuery,
  useArchiveSpaceMutation,
  useUnarchiveSpaceMutation,
  useSetActiveSpaceMutation,
  useSetNotifyOnRunCompleteMutation,
  useSetNotifyOnToolApprovalMutation,
  useDetectInstalledClisQuery,
} from "@/lib/redux/api";
import { ThemePicker } from "@/features/settings/components/theme-picker";
import {
  type OnboardingAgentSlug,
  isOnboardingAgentSlug,
} from "../onboarding-agents";

interface AgentChoice {
  slug: OnboardingAgentSlug;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const AGENT_CHOICES: AgentChoice[] = [
  { slug: "claude", label: "Claude", Icon: Claude },
  { slug: "copilot", label: "Copilot", Icon: CopilotStatic },
  { slug: "codex", label: "Codex", Icon: Codex },
  { slug: "cursor", label: "Cursor", Icon: Cursor },
];

function AgentCard({
  label,
  Icon,
  isSelected,
  onClick,
  disabled,
}: {
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col items-stretch overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer flex-1 min-w-0",
        isSelected
          ? "border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary"
          : "border-primary-200 dark:border-primary-800 text-primary-500 dark:text-primary-400 opacity-80 hover:opacity-100",
        disabled && "opacity-60 cursor-not-allowed",
      )}
      aria-pressed={isSelected}
    >
      <div className="flex flex-row items-center justify-center gap-1 px-4 py-2">
        <Icon className="size-3.5 shrink-0" />
        <span className="text-xs font-medium leading-tight truncate">{label}</span>
      </div>
      <div
        className={cn(
          "flex items-center justify-center h-6 border-t transition-colors",
          isSelected
            ? "border-primary-200 dark:border-primary-800 text-emerald-600 dark:text-emerald-400"
            : "border-primary-200 dark:border-primary-800 text-primary-500 dark:text-primary-400",
        )}
      >
        {isSelected ? (
          <Check className="size-3.5" />
        ) : (
          <Plus className="size-3.5" />
        )}
      </div>
    </Button>
  );
}

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
  const { data: spaces = [] } = useGetSpacesQuery();
  const { data: appSettings } = useGetAppSettingsQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [unarchiveSpace] = useUnarchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const [setNotifyOnRunComplete] = useSetNotifyOnRunCompleteMutation();
  const [setNotifyOnToolApproval] = useSetNotifyOnToolApprovalMutation();
  const { data: detectedClis } = useDetectInstalledClisQuery();
  const hasAppliedAutoSelect = useRef(false);

  const agentSpaces = useMemo(
    () =>
      spaces.filter(
        (s) => s.slug && isOnboardingAgentSlug(s.slug),
      ),
    [spaces],
  );

  const visibleAgentCount = useMemo(
    () => agentSpaces.filter((s) => !s.isArchived).length,
    [agentSpaces],
  );

  const spacesBySlug = useMemo(() => {
    const map = new Map<
      OnboardingAgentSlug,
      { id: string; isArchived: boolean }
    >();
    for (const space of agentSpaces) {
      if (!isOnboardingAgentSlug(space.slug)) continue;
      map.set(space.slug, {
        id: space.id,
        isArchived: space.isArchived,
      });
    }
    return map;
  }, [agentSpaces]);

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

  const handleAgentToggle = async (slug: OnboardingAgentSlug) => {
    const space = agentSpaces.find((s) => s.slug === slug);
    if (!space) return;

    if (space.isArchived) {
      await unarchiveSpace(space.id).unwrap();
      return;
    }

    const visible = agentSpaces.filter((s) => !s.isArchived);
    if (visible.length <= 1) return;

    const remaining = visible
      .filter((s) => s.id !== space.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    await archiveSpace(space.id).unwrap();

    const activeId = appSettings?.activeSpaceId ?? null;
    const archivingActive = activeId === space.id;
    const onlyOneLeft = remaining.length === 1;

    if (archivingActive || onlyOneLeft) {
      const target = remaining[0];
      await setActiveSpace(target.id).unwrap();
      const route = getSpaceDefaultRoute(target);
      setTimeout(() => {
        navigate(route, { replace: true });
      }, 0);
    }
  };

  return (
    <div className="space-y-4 -mt-8">
      <div className="space-y-1 ">
        <h1 className="text-xl font-serif tracking-tight text-primary-900 dark:text-primary-100 leading-tight">
          Welcome to Mains
        </h1>
        <p className="text-s text-primary-600 dark:text-primary-400 leading-relaxed">
          Your AI-powered workspace where ideas rise like mountains and flow
          like water.
        </p>
      </div>


      <div className="space-y-2 mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-s text-primary-900 dark:text-primary-100">
            Theme
          </h2>
        </div>
        <div className="flex justify-center w-full">
          <ThemePicker size="lg" />
        </div>
      </div>

      <div className="space-y-2 mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-s text-primary-900 dark:text-primary-100">
            Pick your agents
          </h2>

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
                onClick={() => handleAgentToggle(slug)}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-2 mt-8 mb-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-s text-primary-900 dark:text-primary-100">
            Notifications
          </h2>

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
          Begin
          <ChevronUp className="w-4 h-4 rotate-90" />
        </Button>
      </div>
    </div>
  );
}
