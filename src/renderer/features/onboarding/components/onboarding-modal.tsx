import { useCallback, useMemo } from "react";
import { WizardModal, type WizardStep } from "@/components/ui";
import { useAppDispatch } from "@/lib/redux/hooks";
import { setOnboardingCompleted } from "@/lib/redux/slices/appSettingsSlice";
import { ClaudeSetupStep } from "./claude-setup-step";
import { CopilotSetupStep } from "./copilot-setup-step";
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
        render: () => <ClaudeSetupStep />,
      },
      {
        id: "copilot",
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
      title=""
      onComplete={completeOnboarding}
      onCancel={completeOnboarding}
      className="max-w-210 mb-24"
    />
  );
}
