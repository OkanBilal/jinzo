import { useCallback, useMemo } from "react";
import {
  WizardModal,
  type WizardStep,
} from "@/components/ui/wizard-modal";
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
        id: "claude",
        render: () => <ClaudeSetupStep />,
      },
      {
        id: "copilot",
        render: () => <CopilotSetupStep />,
      },
      {
        id: "welcome",
        render: () => <WelcomeStep />,
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
      title="Setup"
      onComplete={completeOnboarding}
      onCancel={completeOnboarding}
    />
  );
}
