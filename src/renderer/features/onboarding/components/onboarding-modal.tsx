import type { ComponentType } from "react";
import { useCallback, useMemo } from "react";
import { WizardModal, type WizardStep } from "@/components/ui";
import {
  Codex,
  CopilotStatic,
  Cursor as CursorBrandIcon,
} from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/space";
import { useAppDispatch } from "@/lib/redux/hooks";
import { useGetSpacesQuery } from "@/lib/redux/api";
import { setOnboardingCompleted } from "@/lib/redux/slices/appSettingsSlice";
import {
  isOnboardingAgentSlug,
  type OnboardingAgentSlug,
} from "../onboarding-agents";
import { ClaudeSetupStep } from "./claude-setup-step";
import { CodexSetupStep } from "./codex-setup-step";
import { CopilotSetupStep } from "./copilot-setup-step";
import { CursorSetupStep } from "./cursor-setup-step";
import { WelcomeStep } from "./welcome-step";

interface OnboardingModalProps {
  open: boolean;
}

const STEP_BY_SLUG: Record<
  OnboardingAgentSlug,
  {
    id: string;
    title: string;
    titleIcon: React.ReactNode;
    Setup: ComponentType;
  }
> = {
  claude: {
    id: "claude",
    title: "Claude Setup",
    titleIcon: <Claude size={28} className="text-claude" />,
    Setup: ClaudeSetupStep,
  },
  codex: {
    id: "codex",
    title: "Codex Setup",
    titleIcon: (
      <Codex className="size-7 text-primary-900 dark:text-primary-50" />
    ),
    Setup: CodexSetupStep,
  },
  cursor: {
    id: "cursor",
    title: "Cursor Setup",
    titleIcon: (
      <CursorBrandIcon className="size-7 text-primary-900 dark:text-primary-100" />
    ),
    Setup: CursorSetupStep,
  },
  copilot: {
    id: "copilot",
    title: "GitHub Copilot Setup",
    titleIcon: (
      <CopilotStatic className="size-7 text-primary-900 dark:text-primary-100" />
    ),
    Setup: CopilotSetupStep,
  },
};

export function OnboardingModal({ open }: OnboardingModalProps) {
  const dispatch = useAppDispatch();
  const { data: spaces = [] } = useGetSpacesQuery();

  const completeOnboarding = useCallback(() => {
    dispatch(setOnboardingCompleted(true));
  }, [dispatch]);

  const steps: WizardStep[] = useMemo(() => {
    const welcomeStep: WizardStep = {
      id: "welcome",
      render: () => <WelcomeStep />,
    };

    const activeProviders = spaces
      .filter(
        (s) => s.slug && isOnboardingAgentSlug(s.slug) && !s.isArchived,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const providerSteps: WizardStep[] = activeProviders.map((space) => {
      const slug = space.slug as OnboardingAgentSlug;
      const def = STEP_BY_SLUG[slug];
      const Setup = def.Setup;
      return {
        id: def.id,
        title: def.title,
        titleIcon: def.titleIcon,
        render: () => <Setup />,
      };
    });

    return [welcomeStep, ...providerSteps];
  }, [spaces]);

  return (
    <WizardModal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) completeOnboarding();
      }}
      steps={steps}
      onComplete={completeOnboarding}
      onCancel={completeOnboarding}
      className="max-w-160 mb-24"
    />
  );
}
