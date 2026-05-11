import { useEffect } from "react";
import { useWizard } from "@/components/ui";
import { LoadingState } from "./connection-modal-wrapper";

type StepId = "loading" | "setToken" | "add" | "manage";

interface ConnectionLoadingStepProps {
  targetStep: StepId | null;
  message?: string;
}

export function ConnectionLoadingStep({
  targetStep,
  message = "Loading...",
}: ConnectionLoadingStepProps) {
  const { goTo } = useWizard<any>();

  useEffect(() => {
    if (targetStep && targetStep !== "loading") {
      goTo(targetStep);
    }
  }, [targetStep, goTo]);

  return <LoadingState message={message} />;
}
