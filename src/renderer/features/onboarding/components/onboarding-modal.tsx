import { useCallback, useMemo } from "react";
import { WizardModal, type WizardStep } from "@/components/ui";
import { Codex, CopilotStatic, Cursor as CursorBrandIcon } from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/space";
import { useAppDispatch } from "@/lib/redux/hooks";
import { setOnboardingCompleted } from "@/lib/redux/slices/appSettingsSlice";
import { ClaudeSetupStep } from "./claude-setup-step";
import { CodexSetupStep } from "./codex-setup-step";
import { CopilotSetupStep } from "./copilot-setup-step";
import { CursorSetupStep } from "./cursor-setup-step";
import { WelcomeStep } from "./welcome-step";

interface OnboardingModalProps {
  open: boolean;
}

export function OnboardingModal({ open }: OnboardingModalProps) {
  const dispatch = useAppDispatch();

  const completeOnboarding = useCallback(() => {
    dispatch(setOnboardingCompleted(true));
  }, [dispatch]);

  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: "welcome",

        render: () => <WelcomeStep />,
      },
      {
        id: "claude",
        title: "Claude Setup",
        titleIcon: (
          <Claude size={28} className="text-claude" />
        ),
        render: () => <ClaudeSetupStep />,
      },
      {
        id: "codex",
        title: "Codex Setup",
        titleIcon: (
          <Codex className="size-7 text-primary-900 dark:text-primary-50" />
        ),
        render: () => <CodexSetupStep />,
      },
      {
        id: "cursor",
        title: "Cursor Setup",
        titleIcon: (
          <CursorBrandIcon className="size-7 text-primary-900 dark:text-primary-100" />
        ),
        render: () => <CursorSetupStep />,
      },
      {
        id: "copilot",
        title: "GitHub Copilot Setup",
        titleIcon: <CopilotStatic className="size-7 text-primary-900 dark:text-primary-100"  />,
        render: () => <CopilotSetupStep />,
      },
    ],
    [],
  );

  return (
    <WizardModal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) completeOnboarding();
      }}
      steps={steps}
      onComplete={completeOnboarding}
      onCancel={completeOnboarding}
      className="max-w-180 mb-24"
    />
  );
}
